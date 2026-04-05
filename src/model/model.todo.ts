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

  compare(otherTodo: Todo) {
    if (this.issueNumber !== otherTodo.issueNumber) {
      if (this.issueNumber == null) return 1
      if (otherTodo.issueNumber == null) return -1
      return this.issueNumber - otherTodo.issueNumber
    }

    if (this.fileName !== otherTodo.fileName) {
      return this.fileName.localeCompare(otherTodo.fileName)
    }

    if (this.lineNumber !== otherTodo.lineNumber) {
      return this.lineNumber - otherTodo.lineNumber
    }

    if (this.todoText !== otherTodo.todoText) {
      return this.todoText.localeCompare(otherTodo.todoText)
    }

    if (this.foundInCommit !== otherTodo.foundInCommit) {
      if (this.foundInCommit == null) return 1
      if (otherTodo.foundInCommit == null) return -1
      return this.foundInCommit.localeCompare(otherTodo.foundInCommit)
    }

    return 0
  }
}
