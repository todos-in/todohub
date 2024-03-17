import assert from 'node:assert'
import { RequestError } from '@octokit/request-error'

export class TodohubError extends Error {
  code: string
  cause?: Error
  debugInformation?: object

  /**
   * @param message Message displayed to users (in non-debug environment)
   * @param code Application specific code that should not change from occurrence to occurrence (Displayed to users)
   * @param debugInformation Generic object with additional information meant to be displayed in debug logs only
   * @param cause Original Error that caused the Exception
   */
  constructor(message: string, code?: string, debugInformation?: object, cause?: Error) {
    super(message)
    this.code = code || this.constructor.name
    this.cause = cause
    this.debugInformation = debugInformation
  }

  log() {
    return `${this.code}: ${this.message}`
  }

  debugLog() {
    return JSON.stringify({
      message: this.message,
      code: this.code,
      stack: this.stack,
      debugInformation: this.debugInformation,
      cause: {
        message: this.cause?.message,
        stack: this.cause?.stack,
        errorName: this.cause?.constructor.name,
      },
    })
  }
}

export class EnvironmentLoadError extends TodohubError {
  constructor(debugInformation: { place: string, key: string }) {
    super(`Failed to load from environment: ${debugInformation.key}`, 'env-load', debugInformation)
  }
}

export class EnvironmentParsingError extends TodohubError {
  constructor(message: string) { super(message, 'env-parse') }
}

export class IssueNotInStateError extends TodohubError {
  constructor(issueNr: number) {
    super(`Issue number ${issueNr} not found in Todohub control issues state.`, 'issue-not-in-state', { issueNr: issueNr })
  }
}

export class ControlIssueParsingError extends TodohubError {
  constructor(message: string) { super(message, 'control-issue-parse') }
}

export class ControlIssueDataDecodingError extends TodohubError {
  constructor(message: string, cause?: Error) { super(message, 'control-issue-decode', undefined, cause) }
}

export class RegexError extends TodohubError {
  constructor(message: string) { super(message, 'todo-regex-match') }
}

export function assertGithubError(error: unknown): asserts error is RequestError {
  try {
    assert(error instanceof RequestError)
  } catch (assertError) {
    throw error
  }
}
