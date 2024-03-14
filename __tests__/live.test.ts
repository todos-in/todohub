/* eslint-disable jest/no-disabled-tests --- Skipped because this is only for manual runs for debugging! */

import * as env from './load-env.js'
import path from 'node:path'
env.load(path.join(__dirname, '.prod.env.json'), { GITHUB_EVENT_PATH: path.join(__dirname, '/context.default-branch-push.json') })
import * as main from '../src/main.js'

const runMock = jest.spyOn(main, 'run')

describe.skip('For tests against real github instance.', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('real test', async () => {
    await main.run()
    expect(runMock).toHaveReturned()
  }, 500000)
})
