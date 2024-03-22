import { TTodo } from './validation.js'

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
