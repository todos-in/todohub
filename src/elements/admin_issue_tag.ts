import { gunzipSync, gzipSync } from 'node:zlib'
import { ITodo, TrackedIssue } from 'src/types/todo.js'

export default class TodohubDataTag {
  // TODO order of todos and properties within todo objects can change whether comment needs to be updated even if logical equal
  raw?: string
  decodedData: Record<number, TrackedIssue>

  constructor(tag?: string) {
    if (tag) {
      this.raw = tag
      this.decodedData = this.decode(tag)
      // TODO check decoded JSON schema
    } else {
      this.decodedData = {}
    }
  }

  getTrackedIssuesNumbers() {
    return new Set(Object.keys(this.decodedData))
  }

  getTrackedIssue(issueNr: number): TrackedIssue | undefined {
    return this.decodedData[issueNr]
  }

  setTodoState(
    issueNr: number,
    todoState: ITodo[],
    commitSha: string,
    trackedBranch: string,
  ) {
    this.decodedData[issueNr] = Object.assign(this.decodedData[issueNr] || {}, {
      todoState,
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
    let composed = '#### TODOs:'
    for (const todo of trackedIssue.todoState) {
      composed += `\n* [ ] \`${todo.fileName}\`${todo.lineNumber ? `:${todo.lineNumber}` : ''}: ${todo.keyword} ${todo.todoText} ${todo.link ? `(${todo.link})` : ''}`
    }
    composed += `\n\n<sup>**Last set:** ${trackedIssue.commitSha} | **Tracked Branch:** \`${trackedIssue.trackedBranch}\`<sub>`

    return composed
  }

  equals(_todoState: ITodo[]) {
    // TODO implement order (by filename, linenr?)
  }

  getTodoStateHash() {
    // TODO
  }

  getHash() {
    // TODO implement
  }

  decode(tag: string) {
    const b64Decoded = Buffer.from(tag, 'base64')
    const unzipped = gunzipSync(b64Decoded)
    const parsed = JSON.parse(unzipped.toString('utf-8'))
    return parsed
  }

  encode() {
    const stringified = JSON.stringify(this.decodedData)
    const zipped = gzipSync(Buffer.from(stringified, 'utf-8'))
    const b64Encoded = zipped.toString('base64')
    return b64Encoded
  }
}
