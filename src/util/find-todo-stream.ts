import { Writable } from 'node:stream'
import { matchTodo } from './todo-match.js'
import { ITodo } from '../interfaces/data.js'
import { EnvironmentService } from '../service/environment.js'
import { Logger } from 'interfaces/logger.js'
import { Environment } from '../interfaces/environment.js'

export class FindTodoStream extends Writable {
  private filename?: string
  private currentLineNr = 0
  private todos?: ITodo[]
  private issueNr?: number
  private environment: Environment

  constructor(private envService: EnvironmentService, private logger: Logger) {
    super({ objectMode: true })
    this.environment = envService.getEnv()
  }

  /**
   * Meant to be called by Dependency Injection Container. Brandi cannot inject into constructor directly. 
   * Needs to be called before instance is useful, if not DI is mosconfigured
   * @param todos 
   * @param filename 
   * @param issueNr 
   */
  initDi(todos: ITodo[], filename: string, issueNr?: number) {
    this.todos = todos
    this.filename = filename
    this.issueNr = issueNr
  }

  _write(line: string, _encoding: string, next: () => void) {
    if (!this.filename || !this.todos) {
      throw new Error('FindTodoStream has not been initDi()-ed yet. Class should only be initialized by Dependency Injection Container which handles initalization.')
    }
    this.currentLineNr++
    if (line.length > this.environment.maxLineLength) {
      this.logger.debug(`Skipping line in <${this.filename}> because it exceeds max length of <${this.environment.maxLineLength}> characters. If this is a generated file, consider adding it to .todoignore. Or increase MAX_LINE_LENGTH input.`)
      return next()
    }
    let matchedTodo
    try {
      matchedTodo = matchTodo(line, this.issueNr?.toString())
    } catch (err) {
      this.logger.warning((err as Error).message)
    }
    if (!matchedTodo) {
      return next()
    }
    const todoWithMetadata = Object.assign(matchedTodo, {fileName: this.filename, lineNumber: this.currentLineNr})
    this.todos.push(todoWithMetadata)
    next()
  }
} 
