import { Todo } from './model.todo.js'
import { TDefaultBranchState, TFeatureBranchState, TTodo, TTodoState } from './validation.js'

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