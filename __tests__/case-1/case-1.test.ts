import * as env from '../load-env.js'
import path from 'node:path'
import * as fs from 'node:fs'
env.load(path.join(__dirname, 'environment', 'envvar.json'), { GITHUB_EVENT_PATH: path.join(__dirname, 'environment', 'context.json') })
import * as github from '@actions/github'
import * as core from '@actions/core'
import * as main from '../../src/main.js'
import { getOctokitMock } from '../octokit-mock.js'

const runMock = jest.spyOn(main, 'run')

// TODO #57 octokitMockImplementation, there should also be an explicit environment mockImplementation which takes env-var and context object
// let getInputMock: jest.SpyInstance

let errorMock: jest.SpyInstance
let warningMock: jest.SpyInstance
let setFailedMock: jest.SpyInstance

describe('action', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    errorMock = jest.spyOn(core, 'error').mockImplementation()
    warningMock = jest.spyOn(core, 'warning').mockImplementation()
    setFailedMock = jest.spyOn(core, 'setFailed').mockImplementation()
  })

  it('case 1', async () => {
    const mockedApiResponses = {
      branches: ['main', '2-fixprod'],
      controlIssueSearch: [],
      branchesAheadBy: {
        '2-fixprod': { aheadBy: 3 },
      },
    }

    const p = path.join(__dirname, 'repo')

    const octokitMock = getOctokitMock(mockedApiResponses, p)
    jest.spyOn(github, 'getOctokit').mockImplementation(octokitMock.implementation)

    await main.run()

    expect(runMock).toHaveReturned()

    const todohubControlIssueBody = await octokitMock.spies.rest.issues.create.mock.results[0]?.value
    const expectedIssueData = JSON.parse(fs.readFileSync(path.join(__dirname, 'expected.controlissue.data.json'), 'utf8'))

    expect(todohubControlIssueBody._decoded).toEqual(expectedIssueData)
    expect(octokitMock.spies.rest.issues.create).toHaveBeenCalledWith(expect.objectContaining({ title: 'Todohub Control Center' }))
    expect(octokitMock.spies.rest.issues.create).toHaveBeenCalledTimes(1)
    expect(octokitMock.spies.rest.issues.createComment).toHaveBeenCalledTimes(2)
    expect(setFailedMock).toHaveBeenCalledTimes(0)
    expect(errorMock).toHaveBeenCalledTimes(0)
    expect(warningMock).toHaveBeenCalledTimes(0)
    expect(warningMock).toHaveBeenCalledTimes(0)
  })
})
