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

const encodedData = 'H4sIAAAAAAAAE8WV0WvbMBDG/5Xj9urRdVvG8NvWvgRGO1j3NMq4SOdGVJaEdEoWgv/3IadkdVOcZFnZi0Hou/P3O+uz1rjgmIx3WOM5VmgpyfegSVhfckPZyoVvWyNYY4i8eJ3mhBVKJHW/VXyO5NQca4zcpLM5k05nLRlXhF77b0LCCes1vikPPSxa95qE9Y/brqtwMipZY6TlF+MYa7y5vryGVxMwbbDcshPIiSNQljk7MYqkUG0s3PCvQrBPes+rpY/6oXmZhnF8ldsZR6zfVWhSytv1pMLGWL6itrgpvX62XmfLWGHjs9NTtx2dt7qfXFc9R0Bag3EhCyzIGt27gcZH4JaMHSLs1Y4yvB1l+NPxaITIDSnxETQJzSgxKO8cq95e8N4adzcEObBiFOd8FEfPjsZYRiMM2RkB4SSpn2z5tEPvY7JRwx9f7AxFbv2CQXOIrEp64dPXKbDTwRsn6ens94lPGDsFc7R75Usyhe0KIm+mK3MGy3ekVpBWSbgdIhxYcQLHptVfhbnPIjgvpnn4ufQnpP/pJHPnctgN9UE1J4T7cef0L6kCpVRMQeTEcjDYTtko2/v/w0ZK+ewENFvevU6OKxzl+/CCfIklB7iYQjCBy0uHFM9tnxAbNZb+CrV3/GijLDfWb7uqhLrczlON9WTSdd1vAM3qUJ0IAAA='

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
