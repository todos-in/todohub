import { gunzipSync, gzipSync } from 'node:zlib'
import { ControlIssueDataDecodingError, IssueNotInStateError } from '../error/error.js'
import { ITodo, TrackedIssue } from '../interfaces/todo.js'
import { escapeMd } from '../util/escape-markdown.js'

interface ControlIssueData {
  /** This State was last updated in this commit */
  lastUpdatedCommitSha?: string
  todoStates: Record<number, TrackedIssue>
}

export default class TodohubData {
  private STRAY_TODO_KEY = 0
  // TODO #70 use Map() when parsing? - number keys are allowed..
  // TODO #70 order of todos and properties within todo objects can change whether comment needs to be updated even if logical equal
  // TODO #69 set private and only interact with data via methods
  private decodedData: ControlIssueData

  constructor(tag?: string) {
    if (tag) {
      this.decodedData = this.decode(tag)
    } else {
      this.decodedData = {
        todoStates: {},
      }
    }
  }

  private setTrackedIssue(issueNr: number, trackedIssue: TrackedIssue) {
    this.decodedData.todoStates[issueNr] = trackedIssue
  }

  private setTodoStateOnly(issueNr: number, todoState: ITodo[]) {
    const trackedIssue = this.getTrackedIssue(issueNr)
    trackedIssue.todoState = todoState
  }

  private getTrackedIssue(issueNr: number) {
    const trackedIssue = this.decodedData.todoStates[issueNr]
    if (!trackedIssue) {
      throw new IssueNotInStateError(issueNr)
    }
    return trackedIssue
  }

  getTrackedIssuesNumbers() {
    const issueNrs = new Set(Object.keys(this.decodedData.todoStates).map((key) => Number.parseInt(key)))
    issueNrs.delete(this.STRAY_TODO_KEY)
    return issueNrs
  }

  getIssueTodos() {
    const cloned = Object.assign({}, this.decodedData.todoStates)
    delete cloned[this.STRAY_TODO_KEY]
    return cloned
  }

  getStrayTodos() {
    return this.decodedData.todoStates[this.STRAY_TODO_KEY]
  }

  setStrayTodos(
    todoState: ITodo[] = [],
    commitSha: string,
    trackedBranch: string,
  ) {
    this.setTodoState(this.STRAY_TODO_KEY, todoState, commitSha, trackedBranch)
  }

  clearEmptyTrackedIssue(issueNr: number) {
    if (this.isEmpty(issueNr)) {
      this.clearTrackedIssue(issueNr)
    }
  }

  clearTrackedIssue(issueNr: number) {
    delete this.decodedData.todoStates[issueNr]
  }

  todoOrder(todoA: ITodo, todoB: ITodo) { 
    return ((todoA.issueNumber || 0) - (todoB.issueNumber || 0))
      || todoA.fileName.localeCompare(todoB.fileName)
      || (todoA.lineNumber - todoB.lineNumber)
      || todoA.rawLine.localeCompare(todoB.rawLine)
  }

  todoEquals(todoA: ITodo, todoB: ITodo) {
    // TODO #65 is this enough to compare?
    return (
      todoA.fileName === todoB.fileName &&
      todoA.lineNumber === todoB.lineNumber &&
      todoA.rawLine === todoB.rawLine
    )
  }

  todoStateEquals(issueNr: number, todoState: ITodo[] = []) {
    try {
      const trackedIssue = this.getTrackedIssue(issueNr)
      if (trackedIssue.todoState.length !== todoState.length) {
        return false
      }
      const orderedTodoState = todoState.sort(((a, b) => this.todoOrder(a, b)))
      for (let i = 0; i < trackedIssue.todoState.length; i++) {
        if (!this.todoEquals(trackedIssue.todoState[i] as ITodo, orderedTodoState[i] as ITodo)) {
          return false
        }
      }
      return true
    } catch (err) {
      return false
    }
  }

  setTodoState(
    issueNr: number,
    todoState: ITodo[] = [],
    commitSha: string,
    trackedBranch: string,
  ) {
    const trackedIssue = Object.assign(this.decodedData.todoStates[issueNr] || {}, {
      todoState: todoState,
      commitSha,
      trackedBranch,
    })
    this.setTrackedIssue(issueNr, trackedIssue)
  }

  setLastUpdatedCommit(commitSha: string) {
    this.decodedData.lastUpdatedCommitSha = commitSha
  }

  getLastUpdatedCommit() {
    return this.decodedData.lastUpdatedCommitSha
  }

  isEmpty(issueNr: number) {
    try {
      const trackedIssue = this.getTrackedIssue(issueNr)
      return trackedIssue.todoState.length === 0
    } catch (err) {
      return true
    }
  }

  setCommentId(issueNr: number, commentId: number) {
    const trackedIssue = this.getTrackedIssue(issueNr)
    trackedIssue.commentId = commentId
  }

  setDeadIssue(issueNr: number) {
    const trackedIssue = this.getTrackedIssue(issueNr)
    trackedIssue.deadIssue = true
  }

  deleteExistingCommentId(issueNr: number) {
    const trackedIssue = this.getTrackedIssue(issueNr)
    delete trackedIssue.commentId
  }

  getExistingCommentId(issueNr: number) {
    try {
      return this.getTrackedIssue(issueNr).commentId
    } catch (err) {
      return
    }
  }

  composeTrackedIssueComment(issueNr: number, baseRepoUrl: string) {
    const trackedIssue = this.getTrackedIssue(issueNr)

    let composed = trackedIssue.todoState.length ? '#### TODOs:' : 'No Open Todos'
    for (const todo of trackedIssue.todoState) {
      const link = `[click](${baseRepoUrl}/blob/${this.getTrackedIssue(issueNr).commitSha}/${todo.fileName}#L${todo.lineNumber})`
      composed += `\n* [ ] \`${todo.fileName}:${todo.lineNumber}\`: ${escapeMd(todo.rawLine)} <sup>${link}</sup>`
    }
    composed += `\n\n<sub>**Last set:** ${trackedIssue.commitSha} | **Tracked Branch:** \`${escapeMd(trackedIssue.trackedBranch)}\`</sub>`

    return composed
  }

  private decode(tag: string): ControlIssueData {
    const b64Decoded = Buffer.from(tag, 'base64')
    const unzipped = gunzipSync(b64Decoded)
    // TODO #59 check decoded JSON schema conforms to ControlIssueData
    const parsed = JSON.parse(unzipped.toString('utf-8')) as ControlIssueData

    // Enforces keys format to be positive integers
    const nonIntegerKeys = Object.keys(parsed.todoStates).filter((key) => !/^[0-9]+$/.test(key))
    if (nonIntegerKeys.length) {
      throw new ControlIssueDataDecodingError(`Found non-integer key during Control issue data decoding: <${nonIntegerKeys.join(',')}>`)
    }
    return parsed
  }

  private orderTodoState(issueNr: number) {
    const ordered = this.getTrackedIssue(issueNr).todoState.sort(((a, b) => this.todoOrder(a, b)))
    this.setTodoStateOnly(issueNr, ordered) 
  }

  orderTodoStates() {
    for (const issueNr of Object.keys(this.decodedData.todoStates)) {
      this.orderTodoState(parseInt(issueNr))
    }
  }

  encode() {
    // TODO #70 sort by keys and generate hash?
    this.orderTodoStates()
    const stringified = JSON.stringify(this.decodedData)
    const zipped = gzipSync(Buffer.from(stringified, 'utf-8'))
    const b64Encoded = zipped.toString('base64')
    return b64Encoded
  }
}
