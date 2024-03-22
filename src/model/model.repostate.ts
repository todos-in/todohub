import { STRAY_TODO_KEY, currentVersion } from './constants.js'
import { Todo } from './model.todo.js'
import { TodoState } from './model.todostate.js'
import { TRepoTodoStates, TSupportedVersions, TTodoState } from './validation.js'

export class RepoTodoStates implements TRepoTodoStates {
  private todoStates: Record<number, TodoState> = {}

  constructor(
    private version: TSupportedVersions,
    todoStates: Record<number, TTodoState>,
    private lastUpdatedDefaultCommit?: string,
    private trackedDefaultBranch?: string,
  ) {
    for (const [issueNr, todoState] of Object.entries(todoStates)) {
      this.todoStates[Number.parseInt(issueNr)] = new TodoState(todoState.defaultBranch, todoState.featureBranch, todoState.commentId, todoState.deadIssue)
    }
  }

  static fromScratch() {
    const todoStates = new RepoTodoStates(currentVersion, {})
    return todoStates
  }

  getTodoState(issueNr: number) {
    return this.todoStates[issueNr]
  }

  setDefaultTodoState(issueNr: number, todos: Todo[]): Todo[] | undefined {
    if (!this.getTodoState(issueNr)) {
      this.todoStates[issueNr] = new TodoState({todos})
      return this.getTodoState(issueNr)?.defaultBranch?.todos
    }
    return this.getTodoState(issueNr)?.setDefaultState(todos)
  }

  setFeatureTodoState(issueNr: number, todos: Todo[], name: string, commitSha: string): Todo[] | undefined {
    if (!this.todoStates[issueNr]) {
      this.todoStates[issueNr] = new TodoState()
    }
    return this.getTodoState(issueNr)?.setFeatureState(todos, name, commitSha)
  }

  setStrayTodoState(todos: Todo[]): Todo[] | undefined {
    return this.setDefaultTodoState(STRAY_TODO_KEY, todos)
  }

  setDefaultTrackedBranch(ref: string, commitSha: string) {
    this.trackedDefaultBranch = ref
    this.lastUpdatedDefaultCommit = commitSha
  }

  deleteFeatureTodoState(issueNr: number) {
    this.getTodoState(issueNr)?.deleteFeatureState()
  }

  getTodoStatesByIssueNr() {
    return this.todoStates
  }

  getStrayTodoState() {
    return this.todoStates[STRAY_TODO_KEY]
  }

  getLastUpdatedDefaultCommit() {
    return this.lastUpdatedDefaultCommit
  }

  getTrackedIssuesNumbers() {
    const issueNrs = new Set(Object.keys(this.todoStates).map((key) => Number.parseInt(key)))
    issueNrs.delete(STRAY_TODO_KEY)
    return issueNrs
  }

  setLastUpdatedDefaultCommit(sha: string) {
    this.lastUpdatedDefaultCommit = sha
  }
}