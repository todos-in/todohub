import { gunzipSync, gzipSync } from 'node:zlib'
import { IRepoTodoStates, zRepoTodoStatesDataFormat, IRepoTodoStatesDataFormat } from '../interfaces/data.js'
import { ITodo, TodoState, Encodable } from '../interfaces/data.js'
import { ControlIssueDataDecodingError } from '../error/error.js'

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
class TodoHelper {
  static compare(todoA: ITodo, todoB: ITodo) {
    return ((todoA.issueNumber || 0) - (todoB.issueNumber || 0))
      || todoA.fileName.localeCompare(todoB.fileName)
      || (todoA.lineNumber - todoB.lineNumber)
      || todoA.rawLine.localeCompare(todoB.rawLine)
  }

  static equals(todoA: ITodo, todoB: ITodo) {
    // TODO #65 is this enough to compare?
    return (
      todoA.fileName === todoB.fileName &&
      todoA.lineNumber === todoB.lineNumber &&
      todoA.rawLine === todoB.rawLine
    )
  }
}

const STRAY_TODO_KEY = 0

export class RepoTodoStates implements IRepoTodoStatesDataFormat {

  constructor(
    public todoStates: Record<number, TodoState>,
    public lastUpdatedCommitSha?: string,
  ) { }

  getAllTodoStates() {
    return this.todoStates
  }

  getTodoState(issueNr: number) {
    return this.todoStates[issueNr]
  }

  getIssuesTodoStates() {
    const cloned = Object.assign({}, this.todoStates)
    delete cloned[STRAY_TODO_KEY]
    return cloned
  }

  getStrayTodoState() {
    return this.todoStates[STRAY_TODO_KEY]
  }

  getLastUpdatedCommit() {
    return this.lastUpdatedCommitSha
  }

  getTrackedIssuesNumbers() {
    const issueNrs = new Set(Object.keys(this.todoStates).map((key) => Number.parseInt(key)))
    issueNrs.delete(STRAY_TODO_KEY)
    return issueNrs
  }

  setIssueTodoState(issueNr: number, todoState: TodoState) {
    const newState = Object.assign(this.todoStates[issueNr] || {}, todoState)
    this.todoStates[issueNr] = newState
    this.orderTodoState(issueNr)
    return newState
  }

  setStrayTodoState(todoState: TodoState) {
    return this.setIssueTodoState(STRAY_TODO_KEY, todoState)
  }

  setLastUpdatedCommit(sha: string) {
    this.lastUpdatedCommitSha = sha
  }

  private orderTodoState(issueNr: number) {
    const todoState = this.getTodoState(issueNr)
    if (!todoState) {
      return
    }

    todoState.todos.sort(((a, b) => TodoHelper.compare(a, b)))
  }

  todoStateEquals(issueNr: number, todos: ITodo[] = []) {
    const todoState = this.getTodoState(issueNr)
    if (!todoState || todoState.todos.length !== todos.length) {
      return false
    }

    const orderedTodoState = todos.sort(((a, b) => TodoHelper.compare(a, b)))
    for (const [i, todoA] of todoState.todos.entries()) {
      if (!TodoHelper.equals(todoA, orderedTodoState[i] as ITodo)) {
        return false
      }
    }
    return true
  }
}

export class TodohubControlIssueData extends RepoTodoStates implements IRepoTodoStates, Encodable {

  constructor(
    todoStates: Record<number, TodoState>,
    lastUpdatedCommitSha?: string,
    // Underscored properties exceed the scope of IRepoTodoStates and will be ignored when data is encoded
    public _existingControlIssue?: number,
  ) {
    super(todoStates, lastUpdatedCommitSha)
  }

  static fromScratch() {
    return new TodohubControlIssueData({})
  }

  static decodeFrom(data: string, existingIssueNr: number) {
    const b64Decoded = Buffer.from(data, 'base64')
    const unzipped = gunzipSync(b64Decoded)
    const parsed = JSON.parse(unzipped.toString('utf-8'))
    const decoded = this.checkParsedFormat(parsed)

    return new TodohubControlIssueData(decoded.todoStates, decoded.lastUpdatedCommitSha, existingIssueNr)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static checkParsedFormat(parsed: any) {
    try {
      return zRepoTodoStatesDataFormat.parse(parsed)
    } catch (err) {
      throw new ControlIssueDataDecodingError('Failed to parse data from Ctrl issue.', err instanceof Error ? err : undefined)
    }
  }

  encode() {
    // TODO #70 sort by keys: Check/make sure that TODOs are always ordered when added before writing?
    const stringified = JSON.stringify(this, (key, value) => key.startsWith('_') ? undefined : value)
    const zipped = gzipSync(Buffer.from(stringified, 'utf-8'))
    const b64Encoded = zipped.toString('base64')
    return b64Encoded
  }

}
