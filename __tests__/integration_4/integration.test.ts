import { jest } from '@jest/globals'
import { relativeFilePath  } from '../util.relativepath.js'
import * as fs from 'node:fs'
import { getGithubClientMock } from '../mock/github.mock.js'
import { TOKENS, container } from '../../src/di-container.js'
import { testLogger } from '../mock/logger.mock.js'
import { makeConfigMock, makeMockPushContextGetter } from '../mock/environment.mock.js'

const expectedIssueData = JSON.parse(fs.readFileSync(relativeFilePath(import.meta.url, 'result', 'expected.controlissue.data.json'), 'utf8'))
const pushContextMock = makeMockPushContextGetter(
  relativeFilePath(import.meta.url, 'environment', 'envvar.json'),
  relativeFilePath(import.meta.url, 'environment', 'payload.json'),
)
const configMock = makeConfigMock(relativeFilePath(import.meta.url, 'environment', 'envvar.json'))

const realControlIssue = {
  body: `Here would be some text before the data tag
<!--todohub_ctrl_issue_data="H4sIAAAAAAAAE51RPWvDMBD9K+K6GoJLunhsswRKMjSZSoeLdcYilhROcmLX6L/3FEJpoCltFyHpfdx70gRH4mC8gwpKKKDDELcHjZH0ghrsu/jkrTVR4GF8F0JkrPef4COjq1sBmZowawl1mFk0LhO99i9RjAJUk3jLoq9F05kj8OsEjKdn40icNuvFWt2VKrYmKOxYPEdFgwkSSRmnau8i+06ZEHq6zNnQkBP+VrKn8eRZX4bl1jJ61dsdMVRlAWfel3NjOlqhzenyVgSN751euqu3ScXNGreyFGrXR4VutJ4po0wH/02nv+p/LPjwn4LydZDeUgG13JCLSzGf36eUPgCuNV3pQQIAAA=="-->
Here would be some rendered stuff
<!--todohub_ctrl_issue_end-->
Here could be some text after the tag`,
  number: 100,
}

const corruptedControlIssue = {
  body: 'todohub_ctrl_issue_data something',
  number: 101,
}

const mockedApiResponses = {
  branches: ['main'],
  // TODO #57 use function to create body
  controlIssueSearch: [corruptedControlIssue, realControlIssue],
  branchesAheadBy: {},
}
const githubClientMock = getGithubClientMock(mockedApiResponses, relativeFilePath(import.meta.url, 'repo'))

describe('action: integration test 4: main branch push with existing control issue', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('feature-branch', async () => {
    container.bind(TOKENS.githubClient).toConstant(githubClientMock)
    container.bind(TOKENS.config).toConstant(configMock)
    container.bind(TOKENS.pushContextGetter).toConstant(pushContextMock)
    container.bind(TOKENS.logger).toConstant(testLogger)

    const runner = container.get(TOKENS.runner)

    await runner.run()

    expect(testLogger.error).toHaveBeenCalledTimes(0)
    // We expect one warning because one of the control issue candidates returned by the search endpoint is corrupted and cannot be parsed
    expect(testLogger.warning).toHaveBeenCalledTimes(1)
    // Once to 'reopen' issue 1 with comment 42, once to update the control issue
    expect(githubClientMock.octokit.rest.issues.update).toHaveBeenCalledTimes(2)
    expect(githubClientMock.octokit.rest.issues.update).toHaveBeenCalledWith(expect.objectContaining({ issue_number: 1, state: 'open' }))
    expect(githubClientMock.octokit.rest.issues.update).toHaveBeenCalledWith(expect.objectContaining({ issue_number: 100 }))
    expect(githubClientMock.octokit.rest.issues.updateComment).toHaveBeenCalledTimes(1)
    expect(githubClientMock.octokit.rest.issues.updateComment).toHaveBeenCalledWith(expect.objectContaining({ comment_id: 42 }))

    // Second call is the control issue
    // @ts-expect-error create is a spy
    const todohubControlIssueBody = await githubClientMock.octokit.rest.issues.update.mock.results[1]?.value
    expect(todohubControlIssueBody._decoded).toEqual(expectedIssueData)
  }, 2000000)
})
