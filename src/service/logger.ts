import * as core from '@actions/core'
import { Logger } from 'interfaces/logger.js'

export class ConsoleLogger implements Logger {
  debug(log: string) { console.debug(log) }
  info(log: string) { console.info(log) }
  warning(log: string) { console.warn(log) }
  error(log: string | Error) { console.error(log) }
  startGroup(_name: string) {  }
  endGroup() {  }
}

export class ActionLogger implements Logger {
  debug(log: string) { core.debug(log) }
  info(log: string) { core.info(log) }
  warning(log: string) { core.warning(log) }
  error(log: string | Error) { core.error(log) }
  startGroup(name: string) { core.startGroup(name) }
  endGroup() { core.endGroup() }
}
