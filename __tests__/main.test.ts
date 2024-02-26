/**
 * Unit tests for the action's main functionality, src/main.ts
 *
 * These should be run as if the action was called from a workflow.
 * Specifically, the inputs listed in `action.yml` should be set as environment
 * variables following the pattern `INPUT_<INPUT_NAME>`.
 */

import * as env from './load-env'
import * as core from '@actions/core'
import * as github from '@actions/github'
import * as main from '../src/main'

// Mock the action's main function
const runMock = jest.spyOn(main, 'run')

const actionInputMock: Record<string, string> = {
  token: process.env['token'] || 'test'
}

let debugMock: jest.SpyInstance
let errorMock: jest.SpyInstance
let getInputMock: jest.SpyInstance
let getOctokit: jest.SpyInstance

console.debug(env.default)

describe('action', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    debugMock = jest.spyOn(core, 'debug').mockImplementation()
    errorMock = jest.spyOn(core, 'error').mockImplementation()
    getInputMock = jest
      .spyOn(core, 'getInput')
      .mockImplementation((name: string): string => {
        if (actionInputMock[name]) {
          return actionInputMock[name]
        }
        throw new Error(`Input not set: ${name}`)
      })
    // getOctokit = jest.spyOn(github, 'getOctokit').mockImplementation()
  })

  it('sets the time output', async () => {
    // Set the action's inputs as return values from core.getInput()

    await main.run()
    expect(runMock).toHaveReturned()
  })
})
