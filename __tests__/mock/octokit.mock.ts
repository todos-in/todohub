import { Octokit } from 'octokit'
import { Readable } from 'node:stream'
import * as tar from 'tar'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { gunzipSync } from 'node:zlib'
import { TodohubControlIssue } from '../../src/elements/control-issue.js'
import { RequestError, } from '@octokit/request-error'

interface ApiResponses {
  branches: string[]
  controlIssueSearch: { body: string, number: number, state?: 'open' | 'closed' }[]
  branchesAheadBy: {
    [key: string]: { aheadBy: number }
  }
}

const decodeControlIssueData = (encoded: string) => {
  try {
    const issueContent = TodohubControlIssue.parseContent(encoded)
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
  const tarGzWebStream = Readable.toWeb(stream as Readable)
  return tarGzWebStream
}

const createMockGithubError = (message: string, status: number) => {
  return new RequestError(`Mocked Api Error: ${message}`, status, {headers: {}, request: {method: 'GET', url: '', headers: {}}})
}

class ApiMockError extends Error { }

export const getOctokitMockFactory = (responses: ApiResponses, repoPath: string) => {
  const mock = {
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
        compareCommits: jest.fn(async (options) => {
          const branchAheadBy = responses.branchesAheadBy[options.head]
          if (branchAheadBy) {
            return { data: { ahead_by: branchAheadBy.aheadBy } }
          }
          throw new ApiMockError(`Missing mocked aheadBy response for branch ${options.head}`)
        }),
      },
      issues: {
        update: jest.fn(async (_options) => ({ data: { id: 42 } })),
        create: jest.fn(async (_options) => ({ data: { id: 42 }, _decoded: decodeControlIssueData(_options.body) })),
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

  const getOctokit = (_token: string, _options?: object) => {
    return mock as unknown as Octokit
  }
  getOctokit['spies'] = mock

  return getOctokit
}
