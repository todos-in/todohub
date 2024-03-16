import { TodohubControlIssue } from './elements/control-issue.js'
import { ITodo } from './interfaces/todo.js'
import { Environment } from './interfaces/environment.js'
import { Logger } from './interfaces/logger.js'
import { EnvironmentService } from './service/environment.js'
import GithubService from './service/github.js'

interface RunInfo {
  succesfullyUpdatedIssues: number[]
  skippedIssues: number[],
}

export class Runner {

  private runInfo: RunInfo = {
    succesfullyUpdatedIssues: [],
    skippedIssues: [],
  }

  private env: Environment

  constructor(
    private logger: Logger,
    private environment: EnvironmentService,
    private repo: GithubService,
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
      return this.runInfo
    }

    this.logger.debug('Getting existing Todohub Control Issue...')
    const todohubIssue = await TodohubControlIssue.get(this.repo)
    this.logger.debug(todohubIssue.exists() ?
      `Found existing Todohub Control Issue: <${todohubIssue.existingIssueNumber}>.` :
      'No existing Todohub Control Issue. Needs to be initiated.')

    if (this.env.isFeatureBranch && this.env.featureBranchNumber) {
      this.logger.info(`Push Event into feature branch <${this.env.branchName}> related to issue <${this.env.featureBranchNumber}>...`)

      // TODO #64 instead of getting all TODOs from - get diff from todohubComment to current sha in TodoCommment + apply diff
      // TODO #62 parallelize stuff (+ add workers)

      this.logger.debug(`Searching state <${this.env.commitSha}> for Todos with issue number <${this.env.featureBranchNumber}>...`)
      let todos = await this.repo.getTodosFromGitRef(this.env.commitSha, this.env.featureBranchNumber)
      todos = todos.map(todo => Object.assign(todo, { foundInCommit: this.env.commitSha }))

      await this.updateIssue(this.env.featureBranchNumber, todos, todohubIssue, this.env.commitSha, this.env.ref)
    } else if (this.env.isDefaultBranch) {
      this.logger.info(`Push Event into default branch <${this.env.defaultBranch}>`)

      this.logger.debug(`Searching state< ${this.env.commitSha}> for all Todos`)
      let todos = await this.repo.getTodosFromGitRef(this.env.commitSha)
      todos = todos.map((todo) => Object.assign(todo, { foundInCommit: this.env.commitSha }))

      const issuesWithTodosInCode = new Set(todos.map((todo) => todo.issueNumber || 0).filter(issueNr => issueNr !== 0))
      this.logger.debug(`Found Todos for <${issuesWithTodosInCode.size}> different issues.`)

      const trackedIssues = todohubIssue.data.getTrackedIssuesNumbers()
      this.logger.debug(`Currently <${trackedIssues.size}> issues are tracked in Control Issue.`)

      const issueUnion = Array.from(new Set([...trackedIssues, ...issuesWithTodosInCode]))

      const featureBranches = await this.repo.getFeatureBranches()
      const trackedFeatureBranches = featureBranches.filter((branch) => issueUnion.some((issue) => branch.name.startsWith(`${issue}-`)))
      const branchesAheadOfDefault = await this.repo.getFeatureBranchesAheadOf(this.env.defaultBranch, trackedFeatureBranches.map((branch) => branch.name))

      const issuesWithNoFeatureBranchAheadOfDefault = issueUnion.filter((issue) =>
        !branchesAheadOfDefault.some((branch) => branch.startsWith(`${issue}-`)))
      this.logger.debug(`Feature branches <${branchesAheadOfDefault.join(',')}> are ahead of default <${this.env.defaultBranch}>. These will not be updated.`)

      const strayTodos = todos.filter((todo) => !todo.issueNumber)
      todohubIssue.data.setStrayTodos(strayTodos, this.env.commitSha, this.env.ref)

      for (const issueNr of issuesWithNoFeatureBranchAheadOfDefault) {
        await this.updateIssue(issueNr, todos, todohubIssue, this.env.commitSha, this.env.ref)
      }
    }

    todohubIssue.data.setLastUpdatedCommit(this.env.commitSha)
    this.logger.debug('Writing Todohub Control issue...')
    await todohubIssue.write()

    return this.runInfo
    // TODO #61 set output: all changes in workflow changed_issues, tracked_issues, reopened_issues, skipped_files
  }

  private async updateIssue(issueNr: number, todos: ITodo[], todohubIssue: TodohubControlIssue, commitSha: string, ref: string) {
    this.logger.startGroup(`Processing Issue <${issueNr}>`)
    const issueTodos = todos.filter(todo => todo.issueNumber === issueNr)
    this.logger.info(`Found <${issueTodos?.length || 0}> Todos for Issue <${issueNr}>...`)

    const updateNecessary = !todohubIssue.data.todoStateEquals(issueNr, issueTodos)

    todohubIssue.data.setTodoState(issueNr, issueTodos, commitSha, ref)

    if (updateNecessary) {
      await todohubIssue.writeComment(issueNr)
      await todohubIssue.reopenIssueWithOpenTodos(issueNr)
      this.runInfo.succesfullyUpdatedIssues.push(issueNr)
    } else {
      this.logger.info(`No changes in todo state for issue <${issueNr}> - skip updating.`)
      this.runInfo.skippedIssues.push(issueNr)
    }
    this.logger.endGroup()
  }
}
