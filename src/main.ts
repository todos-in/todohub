import * as core from '@actions/core'
import * as github from '@actions/github'
import Repo from './github-repo.js'
import { TodohubControlIssue } from './elements/control-issue.js'
import { PushEvent } from '@octokit/webhooks-types'
import TodoState from './todo-state.js'

// TODO test TODO testTODO testTODO testTODO testTODO testTODO testTODO testTODO testTODO testTODO testTODO testTODO testTODO testTODO testTODO testTODO testTODO testTODO testTODO testTODO testTODO testTODO testTODO testTODO testTODO testTODO testTODO testTODO testTODO testTODO testTODO testTODO testTODO testTODO testTODO testTODO testTODO testTODO testTODO testTODO testTODO testTODO testTODO testTODO testTODO testTODO testTODO testTODO testTODO testTODO testTODO testTODO testTODO testTODO testTODO testTODO testTODO testTODO testTODO testTODO testTODO testTODO testTODO test
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
// TODO #59 add debug and info logs
/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  const context = github.context
  const payload = github.context.payload as PushEvent
  
  const githubToken = core.getInput('token')
  const defaultBranch = payload.repository.default_branch
  const ref = github.context.ref
  const branchName = ref.split('/').pop() || ''
  const featureBranchRegex = /^(?<featureBranch>[0-9]+)-.*/
  const isDefaultBranch = branchName === defaultBranch
  const featureBranchNumber =
    branchName.match(featureBranchRegex)?.groups?.['featureBranch']
  const isFeatureBranch = featureBranchNumber !== undefined
  const featureBranchNumberParsed = featureBranchNumber
    ? Number.parseInt(featureBranchNumber)
    : undefined
  if (isFeatureBranch && Number.isNaN(featureBranchNumberParsed)) {
    throw new Error('featureBranchNumber is not an integer')
  }
  // TODO #68 check what happens for deleted branches?
  const commitSha = context.sha

  core.info(`Pushing commit: ${commitSha}, ref: ${ref}`)

  try {
    const repo = new Repo(githubToken, context.repo.owner, context.repo.repo)
    core.debug('Getting existing Todohub Control Issue...')
    const todohubIssue = await TodohubControlIssue.get(repo)
    core.debug(todohubIssue.exists() ? 
      `Found existing Todohub Control Issue: ${todohubIssue.existingIssueNumber}.` :
      'No existing Todohub Control Issue. Needs to be initiated.')

    // TODO #59 handle errors
    if (isFeatureBranch && featureBranchNumberParsed) {
      core.info(`Push Event into feature branch ${branchName} related to issue ${featureBranchNumberParsed}...`)

      // TODO #64 instead of getting all TODOs from - get diff from todohubComment to current sha in TodoCommment + apply diff
      // TODO #62 parallelize stuff (+ add workers)

      core.debug(`Searching state ${commitSha} for Todos with issue number ${featureBranchNumber}...`)
      const todoState = await repo.getTodosFromGitRef(commitSha, featureBranchNumber, { foundInCommit: commitSha })

      await updateIssue(featureBranchNumberParsed, todoState, todohubIssue, commitSha, ref)
    } else if (isDefaultBranch) {
      core.info(`Push Event into default branch ${defaultBranch}`)

      core.debug(`Searching state ${commitSha} for all Todos`)
      const todoState = await repo.getTodosFromGitRef(commitSha, undefined, {foundInCommit: commitSha})

      const issuesWithTodosInCode = todoState.getIssuesNumbers()
      core.debug(`Found Todos for ${issuesWithTodosInCode.size} different issues.`)

      const trackedIssues = todohubIssue.data.getTrackedIssuesNumbers()
      core.debug(`Currently ${trackedIssues.size} issues are tracked in Control Issue.`)

      const issueUnion = Array.from(new Set([...trackedIssues, ...issuesWithTodosInCode]))

      const featureBranches = await repo.getFeatureBranches()
      const trackedFeatureBranches = featureBranches.filter((branch) => issueUnion.some((issue) => branch.name.startsWith(`${issue}-`)))
      const branchesAheadOfDefault = await repo.getFeatureBranchesAheadOf(defaultBranch, trackedFeatureBranches.map((branch) => branch.name))

      const issuesWithNoFeatureBranchAheadOfDefault = issueUnion.filter((issue) =>
        !branchesAheadOfDefault.some((branch) => branch.startsWith(`${issue}-`)))

      todohubIssue.data.setTodosWithoutIssueReference(todoState.getTodosWithoutIssueNo(), commitSha, ref)

      for (const issue of issuesWithNoFeatureBranchAheadOfDefault) {
        await updateIssue(issue, todoState, todohubIssue, commitSha, ref)
      }
    }

    core.debug('Writing Todohub Control issue...')
    await todohubIssue.write()

    // TODO #61 set output: all changes in workflow
    // core.setOutput('', )
    // core.setOutput('changed_issues', '')
    // core.setOutput('tracked_issues', Array.from(todohubIssue.data.getTrackedIssuesNumbers()).join(','))
    // core.setOutput('reopened_isues')
    // core.setOutput('skipped_files')

  } catch (error) {
    if (error instanceof Error) {
      core.error(error.message)
      core.setFailed(error.message)
    } else core.setFailed(`Non error was thrown: ${error}`)
  }
}
