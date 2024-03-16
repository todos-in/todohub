import path from 'node:path'
import * as fs from 'node:fs'
import { getOctokitMockFactory } from '../mock/octokit.mock.js'
import { TOKENS, container } from '../../src/di-container.js'
import { debugLogger } from '../mock/logger.mock.js'
import { makeConfigMock, makeMockPushContextGetter } from '../mock/environment.mock.js'

const expectedIssueData = JSON.parse(fs.readFileSync(path.join(__dirname, 'result', 'expected.controlissue.data.json'), 'utf8'))
const pushContextMock = makeMockPushContextGetter(
  path.join(__dirname, 'environment', 'envvar.json'),
  path.join(__dirname, 'environment', 'payload.json'),
)
const configMock = makeConfigMock(path.join(__dirname, 'environment', 'envvar.json'))

const mockedApiResponses = {
  branches: ['main', '2-fixprod'],
  controlIssueSearch: [],
  branchesAheadBy: {
    '2-fixprod': { aheadBy: 3 },
  },
}
const getOctokitMock = getOctokitMockFactory(mockedApiResponses, path.join(__dirname, 'repo'))

describe('action', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('case 1', async () => {
    container.bind(TOKENS.octokitGetter).toConstant(getOctokitMock)
    container.bind(TOKENS.config).toConstant(configMock)
    container.bind(TOKENS.pushContextGetter).toConstant(pushContextMock)
    container.bind(TOKENS.logger).toConstant(debugLogger)

    const runner = container.get(TOKENS.runner)

    await runner.run()

    expect(debugLogger.error).toHaveBeenCalledTimes(0)
    expect(debugLogger.warning).toHaveBeenCalledTimes(0)
    expect(getOctokitMock.spies.rest.issues.create).toHaveBeenCalledWith(expect.objectContaining({ title: 'Todohub Control Center' }))
    expect(getOctokitMock.spies.rest.issues.create).toHaveBeenCalledTimes(1)
    expect(getOctokitMock.spies.rest.issues.createComment).toHaveBeenCalledTimes(2)

    const todohubControlIssueBody = await getOctokitMock.spies.rest.issues.create.mock.results[0]?.value
    expect(todohubControlIssueBody._decoded).toEqual(expectedIssueData)
  }, 1000000)
})
