import { jest } from '@jest/globals'
import { Logger } from '../../src/interfaces/logger.js'

export const testLogger: Logger = {
  debug: jest.fn(),
  info: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
  startGroup: jest.fn(),
  endGroup: jest.fn(),
}

export const debugLogger: Logger = {
  debug: jest.fn((log: string) => console.debug(log)),
  info: jest.fn((log: string) => console.info(log)),
  warning: jest.fn((log: string) => console.warn(log)),
  error: jest.fn((log: string | Error) => console.error(log)),
  startGroup: jest.fn(),
  endGroup: jest.fn(),
}
