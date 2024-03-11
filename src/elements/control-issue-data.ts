import { gunzipSync, gzipSync } from 'node:zlib'
import { ControlIssueDataDecodingError, IssueNotInStateError } from '../error.js'
import { ITodo, TrackedIssue } from '../types/todo.js'

export default class TodohubData {
  private STRAY_TODO_KEY = 0
  private raw?: string
  // TODO #70 use Map() when parsing? - number keys are allowed..
  // TODO #70 order of todos and properties within todo objects can change whether comment needs to be updated even if logical equal
  // TODO #69 set private and only interact with data via methods
  private decodedData: Record<number, TrackedIssue>

  constructor(tag?: string) {
    if (tag) {
      this.raw = tag
      this.decodedData = this.decode(tag)
      // TODO #59 check decoded JSON schema
    } else {
      this.decodedData = {}
    }
  }

  private setTrackedIssue(issueNr: number, trackedIssue: TrackedIssue) {
    this.decodedData[issueNr] = trackedIssue
  }

  private getTrackedIssue(issueNr: number) {
    const trackedIssue = this.decodedData[issueNr]
    if (!trackedIssue) {
      throw new IssueNotInStateError(issueNr)
    }
    return trackedIssue
  }

  getTrackedIssuesNumbers() {
    const issueNrs = new Set(Object.keys(this.decodedData).map((key) => Number.parseInt(key)))
    issueNrs.delete(this.STRAY_TODO_KEY)
    return issueNrs
  }

  getTodos() {
    const cloned = Object.assign({}, this.decodedData)
    delete cloned[this.STRAY_TODO_KEY]
    return cloned
  }

  getStrayTodos() {
    return this.decodedData[this.STRAY_TODO_KEY]
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
    delete this.decodedData[issueNr]
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
      for (const trackedTodo of trackedIssue.todoState) {
        const found = todoState.some((newTodo) => this.todoEquals(newTodo, trackedTodo))
        if (!found) {
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
    const trackedIssue = Object.assign(this.decodedData[issueNr] || {}, {
      todoState: todoState,
      commitSha,
      trackedBranch,
    })  
    this.setTrackedIssue(issueNr, trackedIssue)
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
      composed += `\n* [ ] \`${todo.fileName}${todo.lineNumber ? `:${todo.lineNumber}` : ''}\`: ${todo.rawLine} <sub>${link}</sub>}`
    }
    composed += `\n\n<sub>**Last set:** ${trackedIssue.commitSha} | **Tracked Branch:** \`${trackedIssue.trackedBranch}\`</sub>`

    return composed
  }

  private decode(tag: string) {
    const b64Decoded = Buffer.from(tag, 'base64')
    const unzipped = gunzipSync(b64Decoded)
    const parsed = JSON.parse(unzipped.toString('utf-8'))

    // Enforces keys format to be positive integers
    const nonIntegerKeys = Object.keys(parsed).filter((key) => !/^[0-9]+$/.test(key))
    if (nonIntegerKeys.length) {
      throw new ControlIssueDataDecodingError(`Found non-integer key during Control issue data decoding: <${nonIntegerKeys.join(',')}>`)
    }

    return parsed
  }

  encode() {
    // TODO #70 sort by keys and generate hash?
    const stringified = JSON.stringify(this.decodedData)
    const zipped = gzipSync(Buffer.from(stringified, 'utf-8'))
    const b64Encoded = zipped.toString('base64')
    return b64Encoded
  }
}
