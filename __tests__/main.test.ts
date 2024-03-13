/**
 * Unit tests for the action's main functionality, src/main.ts
 *
 * These should be run as if the action was called from a workflow.
 * Specifically, the inputs listed in `action.yml` should be set as environment
 * variables following the pattern `INPUT_<INPUT_NAME>`.
 */

import * as env from './load-env.js'
import path from 'node:path'
env.load(path.join(__dirname, '.prod.env.json'), { GITHUB_EVENT_PATH: path.join(__dirname, '/context.default-branch-push.json') })
// import * as core from '@actions/core'
// import * as github from '@actions/github'
import * as main from '../src/main.js'

// Mock the action's main function
const runMock = jest.spyOn(main, 'run')

// let debugMock: jest.SpyInstance
// let errorMock: jest.SpyInstance
// let getInputMock: jest.SpyInstance

describe('action', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('real test', async () => {
    // Set the action's inputs as return values from core.getInput()
    await main.run()
    expect(runMock).toHaveReturned()
  }, 150000)
})
