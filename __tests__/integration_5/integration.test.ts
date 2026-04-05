import { jest } from '@jest/globals'
import { relativeFilePath } from '../util.relativepath.js'
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

const encodedData = 'H4sIAAAAAAAAE7WUW2sbMRCF/8owfd2SpsFQ9q1NXgwlCTR9KqGMpdmsiG5II7vG7H8vWhe3W8I6xuRFIHRmdL6jyw7XnLIJHlu8xAYtZfkeNQnrG+6oWLkOzhnBFmPi9fvcEzYoidTzQfElkVc9tpi4yxc9k84XjoyvwqDDNyHhjO0OP9RBT4t2oyZj++NxGBpczEp2mGjz1XjGFh/ubu7g3QKMi5Yde4GSOQEV6dmLUSSVam/hgX9VgmPSZ95uQtJ/mtc0jOfb4lacsL1q0ORcDvNFg52xfEuuuqm9frqgi2VssAvF66U/RBesHpMbmpcISGswPhaBNVmjRzfQhQTsyNgpwlHtLMPHWYa/HU9GSNyRkpBAk9CKMoMK3rMa7cUQrPFPU5BXVsziXM7i6NXJGJtkhKF4IyCcJY/J1qOdep+TzRr+9GZ3KLELawbNMbGqrxc+3y+BvY7BeMn/Z39MfEbsFM3J7lWoL1PYbiHxPl3pGSw/kdpC3mZhN0V4ZcUZHPtWJ6NklhLhegnRRK67TX2/tHyGSTWXdYM6eP5noU731h+HpkZY/8KlxnaxGIbhN0lgEIcLBgAA'

const controlIssue = {
  body: `Todohub Control Issue
<!--todohub_ctrl_issue_data="${encodedData}"-->
Rendered content here
<!--todohub_ctrl_issue_end-->
Footer text`,
  number: 200,
}

const mockedApiResponses = {
  branches: ['main'],
  controlIssueSearch: [controlIssue],
  branchesAheadBy: {},
}
const githubClientMock = getGithubClientMock(mockedApiResponses, relativeFilePath(import.meta.url, 'repo'))

describe('action: integration test 5: reconciliation of changed TODOs', () => {
  beforeAll(() => {
    container.bind(TOKENS.githubApiClient).toConstant(githubClientMock)
    container.bind(TOKENS.config).toConstant(configMock)
    container.bind(TOKENS.pushContextGetter).toConstant(pushContextMock)
    container.bind(TOKENS.logger).toConstant(testLogger)
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('reconciles changed, moved, renamed, removed and new TODOs correctly', async () => {
    const runner = container.get(TOKENS.runner)

    await runner.run()

    expect(testLogger.error).toHaveBeenCalledTimes(0)
    expect(testLogger.warning).toHaveBeenCalledTimes(0)

    // Issue 5 should be updated (comment update) and reopened (has open todos)
    expect(githubClientMock.octokit.rest.issues.update).toHaveBeenCalledWith(expect.objectContaining({ issue_number: 5, state: 'open' }))
    expect(githubClientMock.octokit.rest.issues.updateComment).toHaveBeenCalledWith(expect.objectContaining({ comment_id: 55 }))

    // Control issue should be updated
    expect(githubClientMock.octokit.rest.issues.update).toHaveBeenCalledWith(expect.objectContaining({ issue_number: 200 }))

    // Extract the decoded control issue data from the control issue update call
    // @ts-expect-error update is a spy
    const updateCalls = githubClientMock.octokit.rest.issues.update.mock.calls
    // Find the control issue update call (issue_number: 200)
    const controlIssueCallIndex = updateCalls.findIndex((call: unknown[]) => (call[0] as { issue_number: number }).issue_number === 200)
    expect(controlIssueCallIndex).toBeGreaterThanOrEqual(0)

    // @ts-expect-error update is a spy
    const todohubControlIssueBody = await githubClientMock.octokit.rest.issues.update.mock.results[controlIssueCallIndex]?.value
    expect(todohubControlIssueBody._decoded).toEqual(expectedIssueData)
  }, 2000000)
})
