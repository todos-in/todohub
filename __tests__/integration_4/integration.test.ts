import path from 'node:path'
import * as fs from 'node:fs'
import { getOctokitMockFactory } from '../mock/octokit.mock.js'
import { TOKENS, container } from '../../src/di-container.js'
import { testLogger } from '../mock/logger.mock.js'
import { makeConfigMock, makeMockPushContextGetter } from '../mock/environment.mock.js'

const expectedIssueData = JSON.parse(fs.readFileSync(path.join(__dirname, 'result', 'expected.controlissue.data.json'), 'utf8'))
const pushContextMock = makeMockPushContextGetter(
  path.join(__dirname, 'environment', 'envvar.json'),
  path.join(__dirname, 'environment', 'payload.json'),
)
const configMock = makeConfigMock(path.join(__dirname, 'environment', 'envvar.json'))

const realControlIssue = {
  body: `Here would be some text before the data tag
<!--todohub_ctrl_issue_data="H4sIAAAAAAAAE51SsWrDMBD9FXFdDcGlXTw2XQIlGZJMocPFOmMRSwonmdg1+vee3AylNKXtInRPevfe426C6LXfRowUoJqgzEeGpDpMwHh5MY6ggt3meaPuShVbExR2TKhHRYMJkbQyTtXeRfadMiH0BMXcY0dDFOpvKScaL571VUyATqTXvT0SQ1UWMP/7VDemozXa7C5fhdD43umVW3prTVYexjdIxc0Yt7wU6thHhW60nim/Mp39N5n+yv8x4ON/AmpqIL0WUM/AtsVraPHKWJ9IPzG6uhWUqQmLVkYQFhaNgw8OubgSPw/3KYkbDHF/1rIKevmlX3oH9Q5xaigCAAA="-->
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
const getOctokitMock = getOctokitMockFactory(mockedApiResponses, path.join(__dirname, 'repo'))

describe('action: integration test 4: main branch push with existing control issue', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('feature-branch', async () => {
    container.bind(TOKENS.octokitGetter).toConstant(getOctokitMock)
    container.bind(TOKENS.config).toConstant(configMock)
    container.bind(TOKENS.pushContextGetter).toConstant(pushContextMock)
    container.bind(TOKENS.logger).toConstant(testLogger)

    const runner = container.get(TOKENS.runner)

    await runner.run()

    expect(testLogger.error).toHaveBeenCalledTimes(0)
    // We expect one warning because one of the control issue candidates returned by the search endpoint is corrupted and cannot be parsed
    expect(testLogger.warning).toHaveBeenCalledTimes(1)
    // One to 'reopen' issue 1 with comment 42, once to update the control issue
    expect(getOctokitMock.spies.rest.issues.update).toHaveBeenCalledTimes(2)
    expect(getOctokitMock.spies.rest.issues.update).toHaveBeenCalledWith(expect.objectContaining({ issue_number: 1, state: 'open' }))
    expect(getOctokitMock.spies.rest.issues.update).toHaveBeenCalledWith(expect.objectContaining({ issue_number: 100 }))
    expect(getOctokitMock.spies.rest.issues.updateComment).toHaveBeenCalledTimes(1)
    expect(getOctokitMock.spies.rest.issues.updateComment).toHaveBeenCalledWith(expect.objectContaining({ comment_id: 42 }))

    // Second call is the control issue
    const todohubControlIssueBody = await getOctokitMock.spies.rest.issues.update.mock.results[1]?.value
    expect(todohubControlIssueBody._decoded).toEqual(expectedIssueData)
  }, 2000000)
})
