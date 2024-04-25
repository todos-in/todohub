import { jest } from '@jest/globals'
import { PushEvent } from '@octokit/webhooks-types'
import { Config, PushContextGetter, PushContext } from '../../src/interfaces/config.js'
import * as fs from 'node:fs'

export const makeConfigMock: (envVarPath: string) => Config = (envVarPath) => {
  const environmentVariables = JSON.parse(fs.readFileSync(envVarPath, 'utf8'))
  return {
    getGithubToken: jest.fn(() => environmentVariables['INPUT_TOKEN']),
    getMaxLineLength: jest.fn(() => environmentVariables['INPUT_MAX_LINE_LENGTH']),
  }
}

export const makeMockPushContextGetter: (envVarPath: string, payloadFilePath: string) => PushContextGetter = (envVarPath, payloadFilePath) => {
  const environmentVariables = JSON.parse(fs.readFileSync(envVarPath, 'utf8'))
  const githubContextPayload = JSON.parse(fs.readFileSync(payloadFilePath, 'utf8')) as PushEvent

  return () => {
    return {
      repo: {
        owner: environmentVariables['GITHUB_REPOSITORY'].split('/')[0],
        repo: environmentVariables['GITHUB_REPOSITORY'].split('/')[1],
      },
      sha: environmentVariables['GITHUB_SHA'],
      ref: environmentVariables['GITHUB_REF'],
      eventName: environmentVariables['GITHUB_EVENT_NAME'],
      apiUrl: environmentVariables['GITHUB_API_URL'],
      payload: githubContextPayload,
      runId: 12345678,
      runNumber: 1,
    } as PushContext
  }
}

