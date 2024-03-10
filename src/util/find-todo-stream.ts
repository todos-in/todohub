import { Writable } from 'node:stream'
import { matchTodo } from './todo-match.js'
import TodoState from 'src/todo-state.js'
import { ITodo } from 'src/types/todo.js'
import * as core from '@actions/core'

// TODO #60 move to config
const MAX_LINE_LENGTH_FOR_SEARCHING = 500

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

  _write(line: string, encoding: string, next: () => void) {
    this.currentLineNr++
    if (line.length > MAX_LINE_LENGTH_FOR_SEARCHING) {
      core.debug(`Skipping line in ${this.filename} because it exceeds max length of ${MAX_LINE_LENGTH_FOR_SEARCHING} characters. If this is a generated file, you might want to add it to .todoignore.`)
      return next()
    }
    const matchedTodo = matchTodo(line, this.issueNr)
    if (!matchedTodo) {
      return next()
    }
    const todoWithMetadata = matchedTodo as ITodo & { [key: string]: string } 
    todoWithMetadata.lineNumber = this.currentLineNr
    todoWithMetadata.fileName = this.filename
    for (const [key, value] of Object.entries(this.todoMetadata || {})) {
      todoWithMetadata[key] = value
    }
    this.todoState.addTodos([todoWithMetadata])
    next()
  }
} 
