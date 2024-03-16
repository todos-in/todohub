/* eslint-disable jest/no-disabled-tests -- Skipped because this is only for manual runs for debugging! */

import path from 'node:path'
import {container, TOKENS} from '../src/di-container.js'
import { makeConfigMock, makeMockPushContextGetter } from './mock/environment.mock.js'
import { PersonalAccessTokenOctokitGetter } from '../src/service/octokit.js'


describe.skip('For tests against real github instance.', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('production test', async () => {
    const pushContextMock = makeMockPushContextGetter(
      path.join(__dirname, '.prod.env.json'),
      path.join(__dirname, 'payload.feature-branch-push.json'),
    )
    const configMock = makeConfigMock(path.join(__dirname, '.prod.env.json'))
    
    container.bind(TOKENS.config).toConstant(configMock)
    container.bind(TOKENS.pushContextGetter).toConstant(pushContextMock)
    container.bind(TOKENS.octokitGetter).toConstant(PersonalAccessTokenOctokitGetter)
    const runner = container.get(TOKENS.runner)
    await runner.run()

    expect(1).toBe(1)
  }, 500000)
})
