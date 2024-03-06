import { gunzipSync, gzipSync } from 'node:zlib'
import { ITodo } from 'src/types/todo.js'

export default class TodohubTag {
  // TODO order of todos and properties within todo objects can change whether comment needs to be updated even if logical equal
  todos: ITodo[] = []
  commitSha?: string
  raw?: string
  trackedBranch?: string

  constructor(tag?: string) {
    if (tag) {
      this.raw = tag
      const decoded = this.decode(tag)
      // TODO check decoded JSON schema
      this.todos = decoded.todos
      this.commitSha = decoded.commitSha
      this.trackedBranch = decoded.trackedBranch
    }
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

  mergeTodos(_todos: ITodo[]) {
    // TODO implement
  }

  setTodos(todos: ITodo[], commitSha: string) {
    this.todos = todos
    this.commitSha = commitSha
  }

  decode(tag: string) {
    const b64Decoded = Buffer.from(tag, 'base64')
    const unzipped = gunzipSync(b64Decoded)
    const parsed = JSON.parse(unzipped.toString('utf-8'))
    return parsed
  }

  encode() {
    const stringified = JSON.stringify({
      commitSha: this.commitSha,
      todos: this.todos,
    })
    const zipped = gzipSync(Buffer.from(stringified, 'utf-8'))
    const b64Encoded = zipped.toString('base64')
    return b64Encoded
  }
}
