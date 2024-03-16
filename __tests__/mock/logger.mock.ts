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
  debug: jest.fn().mockImplementation((log: string) => console.debug(log)),
  info: jest.fn().mockImplementation((log: string) => console.info(log)),
  warning: jest.fn().mockImplementation((log: string) => console.warn(log)),
  error: jest.fn().mockImplementation((log: string | Error) => console.error(log)),
  startGroup: jest.fn(),
  endGroup: jest.fn(),
}
