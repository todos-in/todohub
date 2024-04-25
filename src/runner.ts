import { RepoTodoStates } from './model/model.repostate.js'
import { TTodo } from './model/validation.js'
import { Environment } from './interfaces/environment.js'
import { Logger } from './interfaces/logger.js'
import { EnvironmentService } from './service/environment.js'
import GithubService from './service/github.js'
import { DataStore } from './interfaces/datastore.js'
import { GithubCommentFactory } from './service/comment.js'

interface RunInfo {
  succesfullyUpdatedIssues: number[],
  skippedUnchangedIssues: number[],
  failedToUpdate: number[],
  totalTodosUpdated: number,
  todohubIssueId?: number,
  cancelReason?: 'BRANCH_DID_NOT_TRIGGER',
  strayTodos: number,
}

export class Runner {

  private runInfo: RunInfo = {
    succesfullyUpdatedIssues: [],
    skippedUnchangedIssues: [],
    failedToUpdate: [],
    totalTodosUpdated: 0,
    todohubIssueId: undefined,
    strayTodos: 0,
  }

  private env: Environment

  constructor(
    private logger: Logger,
    private environment: EnvironmentService,
    private repo: GithubService,
    private dataStore: DataStore,
    private commentFactory: GithubCommentFactory,
  ) {
    this.env = this.environment.getEnv()
  }
  // TODO #68 concurrency issues if action runs multiple times -> do we need to acquire a lock on issue while other action is running?
  /**
   * The main function for the action.
   * @returns {Promise<void>} Resolves when the action is complete.
   */
  async run(): Promise<RunInfo> {
    // TODO #68 check what happens for deleted branches?

    this.logger.info(`Pushing commit: <${this.env.commitSha}>, ref: <${this.env.ref}>`)
    if (!this.env.isFeatureBranch && !this.env.isDefaultBranch) {
      this.logger.info(`Push event to neither default nor feature branch format ([0-9]-branch-name): <${this.env.branchName}>. Doing nothing...`)
      this.runInfo.cancelReason = 'BRANCH_DID_NOT_TRIGGER'
      return this.runInfo
    }

    this.logger.debug('Getting existing Todohub Control Issue...')
    const todohubState = await this.dataStore.get(undefined)
    
    if (this.env.isFeatureBranch && this.env.featureBranchNumber) {
      await this.featureBranchPush(todohubState, this.env.featureBranchNumber, this.env.branchName)
    } else if (this.env.isDefaultBranch) {
      await this.defaultBranchPush(todohubState, this.env.defaultBranch)
    }

    this.logger.debug('Writing Todohub Control issue...')
    const todohubIssueId = await this.dataStore.write(todohubState)
    this.runInfo.todohubIssueId = todohubIssueId

    return this.runInfo
  }

  private async featureBranchPush(todohubState: RepoTodoStates, featureBranchNr: number, branchName: string) {
    this.logger.info(`Push Event into feature branch <${branchName}> related to issue <${featureBranchNr}>...`)

    // TODO #64 instead of getting all TODOs from - get diff from todohubComment to current sha in TodoCommment + apply diff
    // TODO #62 parallelize stuff (+ add workers)

    this.logger.debug(`Searching state <${this.env.commitSha}> for Todos with issue number <${featureBranchNr}>...`)
    const todos = await this.repo.getTodosFromGitRef(this.env.commitSha, featureBranchNr)

    const updatedFeatureTodoState = todohubState.setFeatureTodoState(featureBranchNr, todos, this.env.ref, this.env.commitSha)
    const commentId = todohubState.getTodoState(featureBranchNr)?.commentId

    if (updatedFeatureTodoState) {
      const writtenCommentId = await this.updateIssue(featureBranchNr, todos, commentId)
      console.info('writtenCommentId', writtenCommentId)
      todohubState.getTodoState(featureBranchNr)?.setComment(writtenCommentId, !writtenCommentId)
    }
  }

  private async defaultBranchPush(todohubState: RepoTodoStates, defaultBranchName: string) {
    this.logger.info(`Push Event into default branch <${defaultBranchName}>`)

    this.logger.debug(`Searching state< ${this.env.commitSha}> for all Todos...`)
    const todos = await this.repo.getTodosFromGitRef(this.env.commitSha)

    const issuesWithTodosInCode = new Set(todos.map((todo) => todo.issueNumber || 0).filter(issueNr => issueNr !== 0))
    this.logger.debug(`Found Todos for <${issuesWithTodosInCode.size}> different issues.`)

    const trackedIssues = todohubState.getTrackedIssuesNumbers()
    this.logger.debug(`Currently <${trackedIssues.size}> issues are tracked in Control Issue.`)

    const issueUnion = Array.from(new Set([...trackedIssues, ...issuesWithTodosInCode]))

    const featureBranches = await this.repo.getFeatureBranches()
    const trackedFeatureBranches = featureBranches.filter((branch) => issueUnion.some((issue) => branch.name.startsWith(`${issue}-`)))
    const branchesAheadOfDefault = await this.repo.getFeatureBranchesAheadOf(defaultBranchName, trackedFeatureBranches.map((branch) => branch.name))

    const strayTodos = todos.filter((todo) => !todo.issueNumber)

    todohubState.setDefaultTrackedBranch(this.env.ref, this.env.commitSha)
    todohubState.setStrayTodoState(strayTodos)

    this.runInfo.strayTodos = strayTodos.length

    for (const issueNr of issueUnion) {
      this.logger.startGroup(`Processing Issue <${issueNr}>`)
      const featureBranchAhead = branchesAheadOfDefault.some((branch) => branch.startsWith(`${issueNr}-`))
      const issueTodos = todos.filter(todo => todo.issueNumber === issueNr)
      const commentId = todohubState.getTodoState(issueNr)?.commentId

      const updatedDefaultTodoState = todohubState.setDefaultTodoState(issueNr, issueTodos)
      if (!featureBranchAhead) {
        todohubState.deleteFeatureTodoState(issueNr)
        if (updatedDefaultTodoState) {
          this.logger.debug(`Updating <${issueNr}>...`)
          const writtenCommentId = await this.updateIssue(issueNr, updatedDefaultTodoState, commentId)
          todohubState.getTodoState(issueNr)?.setComment(writtenCommentId, !writtenCommentId)
        } else {
          this.runInfo.skippedUnchangedIssues.push(issueNr)
          this.logger.debug(`Skip updating <${issueNr}>: no changes in state.`)
        }
      } else {
        this.logger.debug(`Feature branch of issue <${issueNr}> is ahead - skip updating.`)
      }
      this.logger.endGroup()
    }

    todohubState.setLastUpdatedDefaultCommit(this.env.commitSha)
  }

  private async updateIssue(
    issueNr: number,
    todos: TTodo[],
    commentId?: number) {

    const githubComment = this.commentFactory.make(issueNr, commentId, this.env.commitSha, this.env.ref, todos, this.env.runId, this.env.runAttempt)
    const writtenCommentId = await githubComment.write()
    if (writtenCommentId) {
      if (todos.length) {
        await githubComment.reopenIssueWithOpenTodos()
      }
      this.runInfo.succesfullyUpdatedIssues.push(issueNr)
      this.runInfo.totalTodosUpdated += todos.length
    } else {
      this.runInfo.failedToUpdate.push(issueNr)
    }
    return writtenCommentId
  }
}
