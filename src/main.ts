import * as core from '@actions/core'
import * as github from '@actions/github'
import Repo from './github-repo.js'
import { TodohubAdminIssue } from './elements/admin_issue.js'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  // for (const [key, val] of Object.entries(process.env)) {
  //   core.debug('Envvar ' + key + ' --- ' + JSON.stringify(val))
  // }
  // for (const [key, val] of Object.entries(github.context)) {
  //   core.debug('Context ' + key + ' --- ' + JSON.stringify(val))
  // }

  const context = github.context
  const githubToken = core.getInput('token')
  const defaultBranch = context.payload?.repository?.default_branch as string
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
  // TODO check what happens for deleted branches?
  const commitSha = context.sha

  try {
    const repo = new Repo(githubToken, context.repo.owner, context.repo.repo)

    // TODO handle errors
    if (isFeatureBranch && featureBranchNumberParsed) {
      core.debug(`Pushing feature branch ${branchName} related to issue ${featureBranchNumberParsed}...`)
      // TODO instead of getting all TODOs from - get diff from todohubComment to current sha in TodoCommment + apply diff
      // TODO parallelize stuff (+ add workers)
      // TODO get and parse .todoignore to avoid unnecessary searching of files
      // TODO tests + organize Issues

      const getTodohubIssue = TodohubAdminIssue.get(repo)  
      const getTodoState = repo.getTodosFromGitRef(commitSha, featureBranchNumber, {foundInCommit: commitSha})
      const [todohubIssue, todoState] = await Promise.all([
        getTodohubIssue,
        getTodoState
      ])  
      
      const featureTodos = todoState.getByIssueNo(featureBranchNumberParsed)
      todohubIssue.data.setTodoState(featureBranchNumberParsed, featureTodos || [], commitSha, ref)
  
      const existingCommentId = todohubIssue.data.getExistingCommentId(featureBranchNumberParsed)
      const composedComment = todohubIssue.data.composeTrackedIssueComment(featureBranchNumberParsed)

      if (existingCommentId) {
        // TODO add state hash to check whether anything needs to be updated?
        // TODO handle: comment was deleted
        // TODO refactor (do no call repo directly, but via AdminIssue?)
        await repo.updateComment(existingCommentId, composedComment)
      } else {
        // TODO handle: issue doesnt exist
        const created = await repo.createComment(featureBranchNumberParsed, composedComment)
        todohubIssue.data.setCommentId(featureBranchNumberParsed, created.data.id as number)
      }

      // TODO parallelize
      if (!todohubIssue.data.isEmpty(featureBranchNumberParsed)) {
        await repo.updateIssue(featureBranchNumberParsed, undefined, undefined, 'open')
      }

      await todohubIssue.write(repo)
    } else if (isDefaultBranch) {
      const getTodohubIssue = TodohubAdminIssue.get(repo)  
      const getTodoState = repo.getTodosFromGitRef(commitSha, undefined, {foundInCommit: commitSha})
      const [todohubIssue, todoState] = await Promise.all([
        getTodohubIssue,
        getTodoState
      ])

      const trackedIssues = todohubIssue.data.getTrackedIssuesNumbers()
      const issuesWithTodosInCode = todoState.getIssuesNumbers()

      const issueUnion = new Set([...trackedIssues, ...issuesWithTodosInCode])

      const featureBranches = await repo.getFeatureBranches();

      const trackedFeatureBranches = featureBranches.filter((branch) => {
        for (const issue of issueUnion) {
          if (branch.name.startsWith(`${issue}-`)) {
            return true
          }
        }
        return false
      })

      const getComparisons = trackedFeatureBranches.map((branch) => repo.compareCommits('main', branch.name))
      const comparisons = await Promise.all(getComparisons)
      const featureBranchesAhead = comparisons.map((comparison) => comparison.data.ahead_by > 0)
  
      // const findTodohubComments = repo.findTodoHubComments()
      // const getTodoState = repo.getTodosFromGitRef(commitSha, featureBranchNumber)
  
      // const [todohubComments, todoState] = await Promise.all([
      //   findTodohubComments,
      //   getTodoState
      // ])
      
      // for (const [issueId, todohubComment] of Object.entries(todohubComments)) {
      //   for (const [issueNr, todo] of Object.entries(todoState.todosByIssueNo)) {
          
      //   }
      // }



      // search all issues for todo comments
      // search codebase for all todos
      
      // for union of all issues with comments and todos with those numbers {
      //   if (no feature branch for this issue ahead of main) && (todo state has changed) {
      //     apply changes (rewrite or add comment), and save state as main state
      //   }
      //   if (comment does not exist) { createwith main-branch tracking }
      //   if (comment exists) but state has not changes { do nothing (set track main-branch?) }
      //   if (comment exists && state has changed && feature branch is ahead) { do nothing ? }
      // }
      // TODO how does feature branch take over once one exists?
      // TODO get closes issues + reopen if necessary
    }
  
    // TODO set output: all changes in workflow
    // core.setOutput('', )
  } catch (error) {
    if (error instanceof Error){
      core.error(error.message)
      core.setFailed(error.message)
    }
    else core.setFailed('Non error was thrown: ' + error)
  }
}
