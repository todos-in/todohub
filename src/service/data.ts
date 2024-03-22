import { z } from 'zod'

// TODO constants file
const STRAY_TODO_KEY = 0
const currentVersion = '1'

const zTodo = z.object({
  fileName: z.string(),
  lineNumber: z.number().int(),
  rawLine: z.string(),
  keyword: z.string(),
  issueNumber: z.number().int().optional(),
  todoText: z.string(),
  foundInCommit: z.string().optional(),
  doneInCommit: z.string().optional(),
})
export type TTodo = z.infer<typeof zTodo>

const zFeatureBranchState = z.object({
  name: z.string(),
  commitSha: z.string(),
  todos: z.array(zTodo),
})
type TFeatureBranchState = z.infer<typeof zFeatureBranchState>

const zDefaultBranchState = z.object({
  todos: z.array(zTodo),
})
type TDefaultBranchState = z.infer<typeof zDefaultBranchState>

const zTodoState = z.object({
  commentId: z.number().int().optional(),
  deadIssue: z.boolean().optional(),
  defaultBranch: zDefaultBranchState.optional(),
  featureBranch: zFeatureBranchState.optional(),
})
export type TTodoState = z.infer<typeof zTodoState>

const zIntegerString = z.string().regex(/^[0-9]+$/)
const zSupportedVersions = z.enum(['1'], {
  invalid_type_error: 'Unsupported Data Format Version: This Todohub version supports only versions: ["1"]',
})
type TSupportedVersions = z.infer<typeof zSupportedVersions>

const zTodoStates = z.record(zIntegerString, zTodoState)

export const zRepoTodoStates = z.object({
  version: zSupportedVersions,
  todoStates: zTodoStates,
  lastUpdatedDefaultCommit: z.string().optional(),
  trackedDefaultBranch: z.string().optional(),
}).transform((obj) => new RepoTodoStates(obj.version, obj.todoStates, obj.lastUpdatedDefaultCommit, obj.trackedDefaultBranch))
export type TRepoTodoStates = z.infer<typeof zRepoTodoStates>

// Implementations ---
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

export class TodoState implements TTodoState {
  defaultBranch?: DefaultBranchState
  featureBranch?: FeatureBranchState

  constructor(
    defaultBranch?: TDefaultBranchState,
    featureBranch?: TFeatureBranchState,
    public commentId?: number,
    public deadIssue?: boolean) {
    if (defaultBranch) {
      this.defaultBranch = new DefaultBranchState(defaultBranch.todos)
    }
    if (featureBranch) {
      this.featureBranch = new FeatureBranchState(
        featureBranch.todos,
        featureBranch.name,
        featureBranch.commitSha,
      )
    }
  }

  tracksFeatureBranch() {
    return !!this.featureBranch
  }

  setDefaultState(todos: Todo[]): Todo[] | undefined {
    const equalTodos = this.defaultBranch?.equalTodos(todos)
    this.defaultBranch = new DefaultBranchState(todos)
    return equalTodos ?  undefined : this.defaultBranch.todos
  } 

  setFeatureState(todos: Todo[], name: string, commitSha: string): Todo[] | undefined {
    const equalTodos = this.featureBranch?.equalTodos(todos)
    this.featureBranch = new FeatureBranchState(todos, name, commitSha)
    return equalTodos ?  undefined : this.featureBranch.todos
  }

  setComment(id: number | undefined, issueIsDead: boolean) {
    this.commentId = id
    this.deadIssue = issueIsDead
  }

  deleteFeatureState() {
    delete this.featureBranch
  }
}

class DefaultBranchState implements TDefaultBranchState {
  todos: Todo[]
  constructor(todos: TTodo[]) {
    this.todos = todos.map((todo) => new Todo(todo))
  }

  equalTodos(todos: Todo[]) {
    if (this.todos.length !== todos.length) {
      return false
    }

    const orderedTodos = todos.sort(((a, b) => a.compare(b)))

    for (const [i, thisTodo] of this.todos.entries()) {
      if (!thisTodo.equals(orderedTodos[i] as Todo)) {
        return false
      }
    }
    return true
  }
}

class FeatureBranchState extends DefaultBranchState implements TFeatureBranchState {
  constructor(
    todos: TTodo[],
    public name: string,
    public commitSha: string,
  ) {
    super(todos)
  }
}

export class Todo {
  // @ts-expect-error This IS typesafe, but typescript cannot infer type of Object.assign constructor correctly
  fileName: string
  // @ts-expect-error This IS typesafe, but typescript cannot infer type of Object.assign constructor correctly
  lineNumber: number
  // @ts-expect-error This IS typesafe, but typescript cannot infer type of Object.assign constructor correctly
  rawLine: string
  // @ts-expect-error This IS typesafe, but typescript cannot infer type of Object.assign constructor correctly
  keyword: string
  issueNumber?: number
  // @ts-expect-error This IS typesafe, but typescript cannot infer type of Object.assign constructor correctly
  todoText: string
  foundInCommit?: string
  doneInCommit?: string

  constructor(todo: TTodo) {
    Object.assign(this, todo)
  }

  compare(otherTodo: TTodo) {
    return ((this.issueNumber || 0) - (otherTodo.issueNumber || 0))
      || this.fileName.localeCompare(otherTodo.fileName)
      || (this.lineNumber - otherTodo.lineNumber)
      || this.rawLine.localeCompare(otherTodo.rawLine)
  }

  equals(otherTodo: TTodo) {
    // TODO #65 is this enough to compare?
    return (
      this.fileName === otherTodo.fileName &&
      this.lineNumber === otherTodo.lineNumber &&
      this.rawLine === otherTodo.rawLine
    )
  }

}
