import { gunzipSync, gzipSync } from 'node:zlib'
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

  getTrackedIssuesNumbers() {
    const issueNrs = new Set(Object.keys(this.decodedData))
    issueNrs.delete('0')
    return issueNrs
  }

  getTrackedIssue(issueNr: number): TrackedIssue | undefined {
    return this.decodedData[issueNr]
  }

  // TODO: naming: stray/lost?
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
    this.decodedData[issueNr] = Object.assign(this.decodedData[issueNr] || {}, {
      todoState: todoState,
      commitSha,
      trackedBranch,
    })  
  }

  isEmpty(issueNr: number) {
    const trackedIssue = this.decodedData[issueNr]
    if (!trackedIssue) {
      return true
    }
    return trackedIssue.todoState.length === 0
  }

  setCommentId(issueNr: number, commentId: number) {
    const trackedIssue = this.decodedData[issueNr]
    if (!trackedIssue) {
      throw new Error('Cannot set commentId without tracked Issue')
    }
    this.decodedData[issueNr] = Object.assign(trackedIssue, { commentId })
  }

  getExistingCommentId(issueNr: number) {
    return this.decodedData[issueNr]?.commentId
  }

  composeTrackedIssueComment(issueNr: number) {
    const trackedIssue = this.decodedData[issueNr]
    if (!trackedIssue) {
      throw new Error(
        `Issue Comment to be composed does not exist: ${issueNr}`,
      )
    }
    let composed = trackedIssue.todoState.length ? '#### TODOs:' : 'No Open Todos'
    for (const todo of trackedIssue.todoState) {
      composed += `\n* [ ] \`${todo.fileName}${todo.lineNumber ? `:${todo.lineNumber}` : ''}\`: ${todo.keyword} ${todo.todoText} ${todo.link ? `(${todo.link})` : ''}`
    }
    composed += `\n\n<sup>**Last set:** ${trackedIssue.commitSha} | **Tracked Branch:** \`${trackedIssue.trackedBranch}\`<sub>`

    return composed
  }

  decode(tag: string) {
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
