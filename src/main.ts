import * as core from '@actions/core'
import Repo from './github-repo.js'
import { TodohubControlIssue } from './elements/control-issue.js'
import TodoState from './todo-state.js'
import env from './action-environment.js'

// TODO (#18) testytest2

async function updateIssue(issueNr: string | number, todoState: TodoState, todohubIssue: TodohubControlIssue, commitSha: string, ref: string) {
  core.startGroup(`Processing Issue ${issueNr}`)
  const issueNumber = typeof issueNr === 'string' ? Number.parseInt(issueNr) : issueNr
  if (Number.isNaN(issueNumber)) {
    core.warning(`Cannot process with non-integer issue ${issueNr}.`)
    return
  }
  const todos = todoState.getByIssueNo(issueNumber)
  core.info(`Found ${todos?.length || 0} Todos for Issue ${issueNumber}...`)

  todohubIssue.data.setTodoState(issueNumber, todos, commitSha, ref)

  await todohubIssue.writeComment(issueNumber)
  await todohubIssue.updateTrackedIssueState(issueNumber)
  core.endGroup()
}

// TODO #68 concurrency issues if action runs multiple times -> do we need to acquire a lock on issue while other action is running?
/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  // TODO #68 check what happens for deleted branches?

  core.info(`Pushing commit: ${env.commitSha}, ref: ${env.ref}`)

  try {
    const repo = new Repo(env.githubToken, env.repoOwner, env.repo)
    core.debug('Getting existing Todohub Control Issue...')
    const todohubIssue = await TodohubControlIssue.get(repo)
    core.debug(todohubIssue.exists() ? 
      `Found existing Todohub Control Issue: ${todohubIssue.existingIssueNumber}.` :
      'No existing Todohub Control Issue. Needs to be initiated.')

    if (env.isFeatureBranch && env.featureBranchNumber) {
      core.info(`Push Event into feature branch ${env.branchName} related to issue ${env.featureBranchNumber}...`)

      // TODO #64 instead of getting all TODOs from - get diff from todohubComment to current sha in TodoCommment + apply diff
      // TODO #62 parallelize stuff (+ add workers)

      core.debug(`Searching state ${env.commitSha} for Todos with issue number ${env.featureBranchNumber}...`)
      const todoState = await repo.getTodosFromGitRef(env.commitSha, env.featureBranchNumber, { foundInCommit: env.commitSha })

      await updateIssue(env.featureBranchNumber, todoState, todohubIssue, env.commitSha, env.ref)
    } else if (env.isDefaultBranch) {
      core.info(`Push Event into default branch ${env.defaultBranch}`)

      core.debug(`Searching state ${env.commitSha} for all Todos`)
      const todoState = await repo.getTodosFromGitRef(env.commitSha, undefined, {foundInCommit: env.commitSha})

      const issuesWithTodosInCode = todoState.getIssuesNumbers()
      core.debug(`Found Todos for ${issuesWithTodosInCode.size} different issues.`)

      const trackedIssues = todohubIssue.data.getTrackedIssuesNumbers()
      core.debug(`Currently ${trackedIssues.size} issues are tracked in Control Issue.`)

      const issueUnion = Array.from(new Set([...trackedIssues, ...issuesWithTodosInCode]))

      const featureBranches = await repo.getFeatureBranches()
      const trackedFeatureBranches = featureBranches.filter((branch) => issueUnion.some((issue) => branch.name.startsWith(`${issue}-`)))
      const branchesAheadOfDefault = await repo.getFeatureBranchesAheadOf(env.defaultBranch, trackedFeatureBranches.map((branch) => branch.name))

      const issuesWithNoFeatureBranchAheadOfDefault = issueUnion.filter((issue) =>
        !branchesAheadOfDefault.some((branch) => branch.startsWith(`${issue}-`)))

      todohubIssue.data.setTodosWithoutIssueReference(todoState.getTodosWithoutIssueNo(), env.commitSha, env.ref)

      for (const issue of issuesWithNoFeatureBranchAheadOfDefault) {
        await updateIssue(issue, todoState, todohubIssue, env.commitSha, env.ref)
      }
    } else {
      core.info(`Push event to neither default nor feature branch format ([0-9]-branch-name): ${env.branchName} Doing nothing...`)
      return
    }

    core.debug('Writing Todohub Control issue...')
    await todohubIssue.write()

    // TODO #61 set output: all changes in workflow changed_issues, tracked_issues, reopened_issues, skipped_files

  } catch (error) {
    if (error instanceof Error) {
      core.error(error.message + ' ' + error.stack)
      core.setFailed(error.message)
    } else core.setFailed(`Non error was thrown: ${error}`)
  }
}
