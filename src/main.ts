import * as core from '@actions/core'
import * as github from '@actions/github'
import Repo from './github-repo.js'
import { getCached } from './cache.js'

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
  const ref = github.context.ref
  const branchName = ref.split('/').pop() || ''
  const featureBranchRegex = /^(?<featureBranch>[0-9]+)-.*/
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

    // In App? const cachedState = await getCached(context.repo.owner, context.repo.repo)
  
    // TODO handle errors
    if (isFeatureBranch && featureBranchNumberParsed) {
      core.debug(`Pushing feature branch ${branchName} related to issue ${featureBranchNumberParsed}...`)
      // TODO instead of getting all TODOs from - get diff from todohubComment to current sha in TodoCommment
      // TODO apply diff
  
      // TODO get and parse .todoignore to avoid unnecessary searching of files
      // TODO parallelize stuff (+ add workers)
      // TODO tests + organize Issues
      // TODO handle errors
  
      const findTodohubComment = repo.findTodoHubComment(
        featureBranchNumberParsed
      )
      const getTodoState = repo.getTodosFromGitRef(commitSha, featureBranchNumber)
      const [todohubComment, todoState] = await Promise.all([
        findTodohubComment,
        getTodoState
      ])
  
      const featureTodos = todoState.getByIssueNo(featureBranchNumberParsed)
      todohubComment.resetTag() // TODO for now we reset the data and completley rewrite - this should be merged with existing data
      todohubComment.setTodos(featureTodos, commitSha)
      const existingCommentId = todohubComment.getExistingCommentId()
      if (existingCommentId) {
        // TODO add state hash to check whether anything needs to be updated?
        await repo.updateCommentGQl(existingCommentId, todohubComment.compose())
      } else {
        await repo.addCommentGQl(todohubComment.issueId, todohubComment.compose())
      }
    } else {
      const findTodohubComments = repo.findTodoHubComments()
      const getTodoState = repo.getTodosFromGitRef(commitSha, featureBranchNumber)
  
      const [todohubComments, todoState] = await Promise.all([
        findTodohubComments,
        getTodoState
      ])
      
      // for (const [issueId, todohubComment] of Object.entries(todohubComments)) {
      //   for (const [issueNr, todo] of Object.entries(todoState.todosByIssueNo)) {
          
      //   }
      // }

      // const featureBranches = await repo.getFeatureBranches();


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
    if (error instanceof Error) core.setFailed(error.message)
    else core.setFailed('Non error was thrown: ' + error)
  }
}
