import { Writable } from 'node:stream'
import { matchTodo } from './todo-match.js'
import TodoState from 'src/todo-state.js'
import * as core from '@actions/core'
import env from './action-environment.js'

export class FindTodoStream extends Writable {
  private filename: string
  private currentLineNr = 0
  private todoState: TodoState
  private issueNr?: string
  private todoMetadata?: { [key: string]: string }

  constructor(todoState: TodoState, filename: string, issueNr?: string, todoMetadata?: { [key: string]: string }) {
    super({ objectMode: true })
    this.todoState = todoState
    this.filename = filename
    this.issueNr = issueNr
    this.todoMetadata = todoMetadata
  }

  _write(line: string, _encoding: string, next: () => void) {
    this.currentLineNr++
    core.debug(`Line length ${env.maxLineLength}`)
    if (line.length > env.maxLineLength) {
      core.debug(`Skipping line in ${this.filename} because it exceeds max length of ${env.maxLineLength} characters.
        If this is a generated file, consider adding it to .todoignore. Or increase MAX_LINE_LENGTH input.`)
      return next()
    }
    const matchedTodo = matchTodo(line, this.issueNr)
    if (!matchedTodo) {
      return next()
    }
    const todoWithMetadata = Object.assign(matchedTodo, {fileName: this.filename, lineNumber: this.currentLineNr}, this.todoMetadata || {})
    this.todoState.addTodos([todoWithMetadata])
    next()
  }
} 
