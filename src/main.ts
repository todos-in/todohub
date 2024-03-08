import * as core from '@actions/core'
import * as github from '@actions/github'
import Repo from './github-repo.js'
import { TodohubControlIssue } from './elements/control-issue.js'
import { PushEvent } from '@octokit/webhooks-types'

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

    // TODO #59 handle errors
    if (isFeatureBranch && featureBranchNumberParsed) {
      core.info(`Push Event into feature branch ${branchName} related to issue ${featureBranchNumberParsed}...`)

      // TODO #64 instead of getting all TODOs from - get diff from todohubComment to current sha in TodoCommment + apply diff
      // TODO #62 parallelize stuff (+ add workers)

      const getTodohubIssue = TodohubControlIssue.get(repo)
      const getTodoState = repo.getTodosFromGitRef(
        commitSha,
        featureBranchNumber,
        { foundInCommit: commitSha },
      )
      const [todohubIssue, todoState] = await Promise.all([
        getTodohubIssue,
        getTodoState,
      ])

      const featureTodos = todoState.getByIssueNo(featureBranchNumberParsed)
      todohubIssue.data.setTodoState(
        featureBranchNumberParsed,
        featureTodos || [],
        commitSha,
        ref,
      )

      const existingCommentId = todohubIssue.data.getExistingCommentId(featureBranchNumberParsed)
      const composedComment = todohubIssue.data.composeTrackedIssueComment(featureBranchNumberParsed)

      if (existingCommentId) {
        // TODO add state hash to check whether anything needs to be updated?
        // TODO #59 handle: comment was deleted
        // TODO #69 refactor (do no call repo directly, but via AdminIssue?)
        await repo.updateComment(existingCommentId, composedComment)
      } else {
        // TODO #59handle: issue doesnt exist
        const created = await repo.createComment(featureBranchNumberParsed, composedComment)
        todohubIssue.data.setCommentId(featureBranchNumberParsed, created.data.id)
      }

      // TODO #62 parallelize
      if (!todohubIssue.data.isEmpty(featureBranchNumberParsed)) {
        await repo.updateIssue(
          featureBranchNumberParsed,
          undefined,
          undefined,
          'open',
        )
      }

      await todohubIssue.write()
    } else if (isDefaultBranch) {
      core.info(`Push Event into default branch ${defaultBranch}`)
      const getTodohubIssue = TodohubControlIssue.get(repo)
      const getTodoState = repo.getTodosFromGitRef(commitSha, undefined, {foundInCommit: commitSha})
      const [todohubIssue, todoState] = await Promise.all([
        getTodohubIssue,
        getTodoState,
      ])

      const trackedIssues = todohubIssue.data.getTrackedIssuesNumbers()
      const issuesWithTodosInCode = todoState.getIssuesNumbers()

      const issueUnion = Array.from(new Set([...trackedIssues, ...issuesWithTodosInCode]))

      const featureBranches = await repo.getFeatureBranches()
      const trackedFeatureBranches = featureBranches.filter((branch) => issueUnion.some((issue) => branch.name.startsWith(`${issue}-`)))
      const branchesAheadOfDefault = await repo.getFeatureBranchesAheadOf(defaultBranch, trackedFeatureBranches.map((branch) => branch.name))

      // const issuesWithFeatureBranchAheadOfDefault = issueUnion.filter((issue) =>
      //   branchesAheadOfDefault.some((branch) => branch.startsWith(`${issue}-`)))

      const issuesWithNoFeatureBranchAheadOfDefault = issueUnion.filter((issue) =>
        !branchesAheadOfDefault.some((branch) => branch.startsWith(`${issue}-`)))

      todohubIssue.data.setTodosWithoutIssueReference(todoState.getTodosWithoutIssueNo() || [], commitSha, ref)

      for (const issue of issuesWithNoFeatureBranchAheadOfDefault) {
        const issueNumber = Number.parseInt(issue)
        const todos = todoState.getByIssueNo(issueNumber)
        // TODO what if todos are empty? should this be deleted rather than set to empty array
        todohubIssue.data.setTodoState(issueNumber, todos || [], commitSha, ref)

        const existingCommentId = todohubIssue.data.getExistingCommentId(issueNumber)
        const composedComment = todohubIssue.data.composeTrackedIssueComment(issueNumber)

        if (existingCommentId) {
          // TODO add state hash to check whether anything needs to be updated?
          // TODO #59 handle: comment was deleted
          // TODO #69 refactor (do no call repo directly, but via AdminIssue?)
          await repo.updateComment(existingCommentId, composedComment)
        } else {
          // TODO #62 parallelize
          try {
            const created = await repo.createComment(issueNumber, composedComment)
            todohubIssue.data.setCommentId(issueNumber, created.data.id)
          } catch (err) {
            // TODO #59  handle: issue doesnt exist? Create?
            console.warn(err)
          }
        }

        // TODO #62 parallelize
        if (!todohubIssue.data.isEmpty(issueNumber)) {
          try {
            await repo.updateIssue(
              issueNumber,
              undefined,
              undefined,
              'open',
            )
          } catch (err) {
            // TODO #59 handle: issue doesnt exist? Create?
            console.warn(err)
          }
        }
      }
      await todohubIssue.write()

      // for union of all issues with comments and todos with those numbers {
      //   if (no feature branch for this issue ahead of main) && (todo state has changed) {
      //     apply changes (rewrite or add comment), and save state as main state
      //   }
      //   if (comment does not exist) { createwith main-branch tracking }
      //   if (comment exists) but state has not changes { do nothing (set track main-branch?) }
      //   if (comment exists && state has changed && feature branch is ahead) { do nothing ? }
      // }
    }

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
