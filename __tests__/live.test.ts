/* eslint-disable jest/no-disabled-tests -- Skipped because this is only for manual runs for debugging! */
import { jest } from '@jest/globals'
import { relativeFilePath  } from './util.relativepath.js'
import {container, TOKENS} from '../src/di-container.js'
import { makeConfigMock, makeMockPushContextGetter } from './mock/environment.mock.js'

describe.skip('For tests against real github instance.', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('production test', async () => {
    const pushContextMock = makeMockPushContextGetter(
      relativeFilePath(import.meta.url, '.prod.env.json'),
      relativeFilePath(import.meta.url, 'payload.default-branch-push.json'),
    )
    const configMock = makeConfigMock(relativeFilePath(import.meta.url, '.prod.env.json'))
    
    container.bind(TOKENS.config).toConstant(configMock)
    container.bind(TOKENS.pushContextGetter).toConstant(pushContextMock)
    const runner = container.get(TOKENS.runner)
    await runner.run()

    expect(1).toBe(1)
  }, 500000)
})
