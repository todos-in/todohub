import { Todo } from './model.todo.js'
import { TDefaultBranchState, TFeatureBranchState, TTodo, TTodoState } from './validation.js'
import { reconcileTodos } from '../util/todo-reconcile.js'

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

  setDefaultState(todos: Todo[], commitSha: string): Todo[] | undefined {
    const previousTodos = this.defaultBranch?.todos || []
    const { todos: reconciled, changed } = reconcileTodos(previousTodos, todos, commitSha)
    this.defaultBranch = new DefaultBranchState(reconciled)
    return changed ? this.defaultBranch.todos : undefined
  } 

  setFeatureState(todos: Todo[], name: string, commitSha: string): Todo[] | undefined {
    const previousTodos = this.featureBranch?.todos || []
    const { todos: reconciled, changed } = reconcileTodos(previousTodos, todos, commitSha)
    this.featureBranch = new FeatureBranchState(reconciled, name, commitSha)
    return changed ? this.featureBranch.todos : undefined
  }

  setComment(id: number | undefined, issueIsDead: boolean) {
    this.commentId = id
    this.deadIssue = issueIsDead
  }

  deleteFeatureState() {
    delete this.featureBranch
  }

  sort() {
    this.featureBranch?.sort()
    this.defaultBranch?.sort()
  }
}

class DefaultBranchState implements TDefaultBranchState {
  todos: Todo[]
  constructor(todos: TTodo[]) {
    this.todos = todos.map((todo) => new Todo(todo))
  }

  sort() {
    this.todos.sort((a, b) => a.compare(b))
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
