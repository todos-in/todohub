import { gunzipSync, gzipSync } from 'node:zlib'
import { IssueNotInStateError } from 'src/error.js'
import { ITodo, TrackedIssue } from 'src/types/todo.js'

export default class TodohubData {
  raw?: string
  // TODO #70 use Map() when parsing? - number keys are allowed..
  // TODO #70 order of todos and properties within todo objects can change whether comment needs to be updated even if logical equal
  // TODO #69 set private and only interact with data via methods
  decodedData: Record<number, TrackedIssue>

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
    const issueNrs = new Set(Object.keys(this.decodedData))
    issueNrs.delete('0')
    return issueNrs
  }

  // TODO #69 naming: stray/lost?
  getTodosWithIssueReference() {
    const cloned = Object.assign({}, this.decodedData)
    delete cloned[0]
    return cloned
  }

  getTodosWithoutIssueReference() {
    return this.decodedData[0]
  }

  setTodosWithoutIssueReference(
    todoState: ITodo[] = [],
    commitSha: string,
    trackedBranch: string,
  ) {
    this.setTodoState(0, todoState, commitSha, trackedBranch)
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

  composeTrackedIssueComment(issueNr: number) {
    const trackedIssue = this.getTrackedIssue(issueNr)

    let composed = trackedIssue.todoState.length ? '#### TODOs:' : 'No Open Todos'
    for (const todo of trackedIssue.todoState) {
      composed += `\n* [ ] \`${todo.fileName}${todo.lineNumber ? `:${todo.lineNumber}` : ''}\`: ${todo.keyword} ${todo.todoText} ${todo.link ? `(${todo.link})` : ''}`
    }
    composed += `\n\n<sub>**Last set:** ${trackedIssue.commitSha} | **Tracked Branch:** \`${trackedIssue.trackedBranch}\`</sub>`

    return composed
  }

  private decode(tag: string) {
    const b64Decoded = Buffer.from(tag, 'base64')
    const unzipped = gunzipSync(b64Decoded)
    const parsed = JSON.parse(unzipped.toString('utf-8'))
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
