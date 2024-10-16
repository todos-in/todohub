/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest } from '@jest/globals'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { gunzipSync } from 'node:zlib'
import { Readable } from 'node:stream'
import { RequestError } from '@octokit/request-error'
import * as tar from 'tar'
import { TOKENS, container } from '../../src/di-container.js'
import { TodohubControlIssueDataStore } from '../../src/service/datastore.js'
import { GithubApiClient } from '../../src/service/github-api-client.js'

interface ApiResponses {
  branches: string[]
  controlIssueSearch: { body: string, number: number, state?: 'open' | 'closed' }[]
  branchesAheadBy: {
    [key: string]: { aheadBy: number }
  }
}

const decodeControlIssueData = (encoded: string) => {
  const dataStore = container.get(TOKENS.dataStore) as TodohubControlIssueDataStore
  try {
    const issueContent = dataStore.parseBodyParts(encoded)
    const b64Decoded = Buffer.from(issueContent.data, 'base64')
    const unzipped = gunzipSync(b64Decoded)
    return JSON.parse(unzipped.toString('utf-8'))
  } catch (err) {
    console.warn('Decoding Control issue data failed: ' + encoded)
    return undefined
  }
}

const createTarGzStream = (repoPath: string) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stream = tar.create({ gzip: true, cwd: path.dirname(repoPath) }, [path.basename(repoPath)]) as any
  stream['_readableState'] = {} // Hack to trick nodeJs Readable.toWeb into accepting tar.create stream
  // @ts-ignore stream is missing properties to be accepted as Readable, but it works for now.
  // this is failing after at least node 20.17.x, needs to solved properly before upgrading
  const tarGzWebStream = Readable.toWeb(stream as Readable)
  return tarGzWebStream
}

const createMockGithubError = (message: string, status: number) => {
  return new RequestError(`Mocked Api Error: ${message}`, status, {request: {method: 'GET', url: '', headers: {}}})
}

class ApiMockError extends Error { }

export const getGithubClientMock = (responses: ApiResponses, repoPath: string) => {
  const octokitMock = {
    request: jest.fn(async (_req: string, _options: object) => { throw new ApiMockError('Request fn is not mock-implemented yet') }),
    paginate: {
      iterator: (request: () => Promise<{ data: { total_count: number, items: [] } }>) => {
        return (async function* () {
          const response = await request()
          yield { total_count: response.data.total_count, data: response.data.items }
        })()
      },
    },
    rest: {
      repos: {
        getContent: jest.fn(async (_options) => {
          try {
            const data = fs.readFileSync(path.join(repoPath, '.todoignore'), 'utf8')
            return {data}
          } catch (err) {
            throw createMockGithubError('Couldnt read .todoignore.', 404)
          }
        }),
        downloadTarballArchive: jest.fn(async (_options) => ({ data: createTarGzStream(repoPath) })),
        listBranches: jest.fn(async (_options: object) => {
          return {
            data: {
              total_count: responses.branches.length,
              items: responses.branches.map(branchName =>
                ({ name: branchName })),
            },
          }
        }),
        compareCommits: jest.fn(async (options: any) => {
          const branchAheadBy = responses.branchesAheadBy[options.head]
          if (branchAheadBy) {
            return { data: { ahead_by: branchAheadBy.aheadBy } }
          }
          throw new ApiMockError(`Missing mocked aheadBy response for branch ${options.head}`)
        }),
      },
      issues: {
        // add _decoded: dirty hack to get the decoded data for easier testing
        update: jest.fn(async (_options: any) => ({ data: { id: 42 }, _decoded: _options.body && _options.body.includes('<!--todohub_ctrl_issue_data') ? decodeControlIssueData(_options.body) : undefined })),
        create: jest.fn(async (_options: any) => ({ data: { id: 42 }, _decoded: decodeControlIssueData(_options.body) })),
        createComment: jest.fn(async (_options) => ({ data: { id: 42 } })),
        updateComment: jest.fn(async (_options) => ({ data: { id: 42 } })),
      },
      search: {
        issuesAndPullRequests: jest.fn(async (_options: object) => {
          return {
            data: {
              total_count: responses.controlIssueSearch.length,
              items: responses.controlIssueSearch,
            },
          }
        }),
      },
    },
    graphql: jest.fn(async (_query, _vars) => ({})),
  }

  return {
    octokit: octokitMock,
  } as unknown as GithubApiClient
}
