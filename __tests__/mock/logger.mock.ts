import { Logger } from '../../src/util/logger.js'

export const debugLogger: Logger = {
  debug: jest.fn().mockImplementation((log: string) => console.debug(log)),
  info: jest.fn().mockImplementation((log: string) => console.info(log)),
  warning: jest.fn().mockImplementation((log: string) => console.warn(log)),
  error: jest.fn().mockImplementation((log: string | Error) => console.error(log)),
  startGroup: jest.fn(),
  endGroup: jest.fn(),
}
