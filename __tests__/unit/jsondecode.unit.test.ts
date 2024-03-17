import { ControlIssueDataDecodingError } from '../../src/error/error.js'
import { TodohubControlIssueData } from '../../src/service/data.js'

describe('JSON decoding unit tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('Negative: Unrelated object', async () => {
    expect(() => TodohubControlIssueData.checkParsedFormat({ hello: 1 })).toThrow(ControlIssueDataDecodingError)
  })

  it('Negative: Unrelated number', async () => {
    expect(() => TodohubControlIssueData.checkParsedFormat(1)).toThrow(ControlIssueDataDecodingError)
  })

  it('Negative: Unrelated string', async () => {
    expect(() => TodohubControlIssueData.checkParsedFormat('string')).toThrow(ControlIssueDataDecodingError)
  })

  it('Valid', async () => {
    const data = {
      todoStates: {
        0: {
          commitSha: 'xyz',
          todos: [],
          trackedBranch: 'refs/heads/main',
        },
        1: {
          todos: [
            {
              rawLine: 'TODO #1 this already existed in control issue',
              todoText: 'this already existed in control issue',
              keyword: 'TODO',
              lineNumber: 1,
              issueNumber: 1,
              fileName: 'file',
              foundInCommit: 'xyz',
            },
            {
              rawLine: 'TODO #1 this is new',
              todoText: 'this is new',
              keyword: 'TODO',
              lineNumber: 2,
              issueNumber: 1,
              fileName: 'file',
              foundInCommit: 'xyz',
            },
          ],
          commitSha: 'xyz',
          trackedBranch: 'refs/heads/main',
          commentId: 42,
        },
      },
      lastUpdatedCommitSha: 'xyz',
    }
    expect(() => TodohubControlIssueData.checkParsedFormat(data)).not.toThrow()
  })

  it('Valid: empty array', async () => {
    const data = {
      todoStates: {
        0: {
          commitSha: 'xyz',
          todos: [],
          trackedBranch: 'refs/heads/main',
        },
      },
      lastUpdatedCommitSha: 'xyz',
    }
    expect(() => TodohubControlIssueData.checkParsedFormat(data)).not.toThrow()
  })

  it('Negative: non integer key', async () => {
    const data = {
      todoStates: {
        test: {
          commitSha: 'xyz',
          todos: [],
          trackedBranch: 'refs/heads/main',
        },
      },
      lastUpdatedCommitSha: 'xyz',
    }
    expect(() => TodohubControlIssueData.checkParsedFormat(data)).toThrow(ControlIssueDataDecodingError)
  })

  it('Negative: mandatory missing', async () => {
    const data = {
      lastUpdatedCommitSha: 'xyz',
    }
    expect(() => TodohubControlIssueData.checkParsedFormat(data)).toThrow(ControlIssueDataDecodingError)
  })

  it('Valid: optional missing', async () => {
    const data = {
      todoStates: {
        0: {
          commitSha: 'xyz',
          todos: [],
          trackedBranch: 'refs/heads/main',
        },
      },
    }
    expect(() => TodohubControlIssueData.checkParsedFormat(data)).not.toThrow()
  })

  it('Negative: mandatory missing 2', async () => {
    const data = {
      todoStates: {
        0: {
          rawLine: 'TODO #1 this already existed in control issue',
          todoText: 'this already existed in control issue',
          lineNumber: 1,
          issueNumber: 1,
          fileName: 'file',
          foundInCommit: 'xyz',
        },
      },
    }
    expect(() => TodohubControlIssueData.checkParsedFormat(data)).toThrow(ControlIssueDataDecodingError)
  })

  it('Valid equals original data', async () => {
    const data = {
      todoStates: {
        0: {
          commitSha: 'abc',
          trackedBranch: '1-feat-branch',
          todos: [
            {
              rawLine: 'TODO #1 this already existed in control issue',
              todoText: 'this already existed in control issue',
              lineNumber: 1,
              keyword: 'TODO',
              issueNumber: 1,
              fileName: 'file',
              foundInCommit: 'xyz',
            },
          ],
        },
      },
    }

    const decoded = TodohubControlIssueData.checkParsedFormat(data)
    expect(decoded).toEqual(data)
  })
})
