import { jest } from '@jest/globals'
import { ControlIssueDataDecodingError } from '../../src/error/error.js'
import { TodohubControlIssueDataStore } from '../../src/service/datastore.js'
import { TOKENS, container } from '../../src/di-container.js'
import { setupEmptyMocks } from '../mock/empty.mock.js'

let dataStore: TodohubControlIssueDataStore

describe('JSON decoding unit tests', () => {
  beforeEach(() => {
    setupEmptyMocks(container)
    dataStore = container.get(TOKENS.dataStore) as TodohubControlIssueDataStore

    jest.clearAllMocks()
  })

  it('Negative: Unrelated object', async () => {
    expect(() => dataStore.checkParsedFormat({ hello: 1 })).toThrow(ControlIssueDataDecodingError)
  })

  it('Negative: Unrelated number', async () => {
    expect(() => dataStore.checkParsedFormat(1)).toThrow(ControlIssueDataDecodingError)
  })

  it('Negative: Unrelated string', async () => {
    expect(() => dataStore.checkParsedFormat('string')).toThrow(ControlIssueDataDecodingError)
  })

  it('Valid', async () => {
    const data = {
      version: '1',
      trackedDefaultBranch: 'refs/heads/main',
      lastUpdatedDefaultCommit: '1b3dv3',
      todoStates: {
        0: {
          defaultBranch: {
            todos: [],
          },
        },
        1: {
          defaultBranch: {
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
          },
          featureBranch: {
            todos: [
              {
                rawLine: 'TODO #1 feat branch todo',
                todoText: 'feat branch todo',
                keyword: 'TODO',
                lineNumber: 2,
                issueNumber: 1,
                fileName: 'file',
                foundInCommit: 'xyz',
              },
            ],
            commitSha: 'asd',
            name: '1-feat-branch',
          },
          commentId: 42,
          deadIssue: true,
        },
      },
    }
    expect(() => dataStore.checkParsedFormat(data)).not.toThrow()
  })

  it('Valid: empty arrays', async () => {
    const data = {
      version: '1',
      trackedDefaultBranch: 'refs/heads/main',
      lastUpdatedDefaultCommit: '1b3dv3',
      todoStates: {
        0: {
          defaultBranch: {
            todos: [],
          },
        },
        1: {
          defaultBranch: {
            todos: [],
          },
          featureBranch: {
            todos: [],
            commitSha: 'asd',
            name: '1-feat-branch',
          },
          commentId: 42,
          deadIssue: true,
        },
      },
    }
    expect(() => dataStore.checkParsedFormat(data)).not.toThrow()
  })

  it('Negative: non integer key', async () => {
    const data = {
      version: '1',
      trackedDefaultBranch: 'refs/heads/main',
      lastUpdatedDefaultCommit: '1b3dv3',
      todoStates: {
        test: {
          defaultBranch: {
            todos: [
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
          },
          commentId: 42,
          deadIssue: true,
        },
      },
    }
    expect(() => dataStore.checkParsedFormat(data)).toThrow(ControlIssueDataDecodingError)
  })

  it('Valid: minimal', async () => {
    const data = {
      version: '1',
      todoStates: {},
    }
    expect(() => dataStore.checkParsedFormat(data)).not.toThrow()
  })

  it('Negative: mandatory missing in TODO: lineNumber', async () => {
    const data = {
      version: '1',
      trackedDefaultBranch: 'refs/heads/main',
      lastUpdatedDefaultCommit: '1b3dv3',
      todoStates: {
        1: {
          defaultBranch: {
            todos: [
              {
                rawLine: 'TODO #1 this already existed in control issue',
                todoText: 'this already existed in control issue',
                keyword: 'TODO',
                issueNumber: 1,
                fileName: 'file',
                foundInCommit: 'xyz',
              },
            ],
          },
          commentId: 42,
          deadIssue: true,
        },
      },
    }
    expect(() => dataStore.checkParsedFormat(data)).toThrow(ControlIssueDataDecodingError)
  })

  it('Valid: optional missing in TODO: issueNr', async () => {
    const data = {
      version: '1',
      trackedDefaultBranch: 'refs/heads/main',
      lastUpdatedDefaultCommit: '1b3dv3',
      todoStates: {
        1: {
          defaultBranch: {
            todos: [
              {
                rawLine: 'TODO #1 this already existed in control issue',
                todoText: 'this already existed in control issue',
                keyword: 'TODO',
                lineNumber: 1,
                fileName: 'file',
                foundInCommit: 'xyz',
              },
            ],
          },
          commentId: 42,
          deadIssue: true,
        },
      },
    }
    expect(() => dataStore.checkParsedFormat(data)).not.toThrow()
  })

  it('Valid: optional missing in State: defaultBranch', async () => {
    const data = {
      version: '1',
      todoStates: {
        1: {
          featureBranch: {
            todos: [
              {
                rawLine: 'TODO #1 feat branch todo',
                todoText: 'feat branch todo',
                keyword: 'TODO',
                lineNumber: 2,
                issueNumber: 1,
                fileName: 'file',
                foundInCommit: 'xyz',
              },
            ],
            commitSha: 'asd',
            name: '1-feat-branch',
          },
          commentId: 42,
          deadIssue: true,
        },
      },
    }
    expect(() => dataStore.checkParsedFormat(data)).not.toThrow()
  })

  it('Not valid: missing mandatory in FeatureBranch: name', async () => {
    const data = {
      version: '1',
      commentId: 42,
      todoStates: {
        1: {
          featureBranch: {
            todos: [
              {
                rawLine: 'TODO #1 feat branch todo',
                todoText: 'feat branch todo',
                keyword: 'TODO',
                lineNumber: 2,
                issueNumber: 1,
                fileName: 'file',
                foundInCommit: 'xyz',
              },
            ],
            commitSha: 'asd',
          },
          commentId: 42,
          deadIssue: true,
        },
      },
    }
    expect(() => dataStore.checkParsedFormat(data)).toThrow(ControlIssueDataDecodingError)
  })

  it('Not Valid: unsupported version', async () => {
    const data = {
      version: '423',
      commentId: 42,
      todoStates: {
        1: {
          featureBranch: {
            todos: [
              {
                rawLine: 'TODO #1 feat branch todo',
                todoText: 'feat branch todo',
                keyword: 'TODO',
                lineNumber: 2,
                issueNumber: 1,
                fileName: 'file',
                foundInCommit: 'xyz',
              },
            ],
            commitSha: 'asd',
            name: '1-feat-branch',
          },
          commentId: 42,
          deadIssue: true,
        },
      },
    }
    expect(() => dataStore.checkParsedFormat(data)).toThrow(ControlIssueDataDecodingError)
  })

  it('Not Valid: version missing', async () => {
    const data = {
      commentId: 42,
      todoStates: {
        1: {
          featureBranch: {
            todos: [
              {
                rawLine: 'TODO #1 feat branch todo',
                todoText: 'feat branch todo',
                keyword: 'TODO',
                lineNumber: 2,
                issueNumber: 1,
                fileName: 'file',
                foundInCommit: 'xyz',
              },
            ],
            commitSha: 'asd',
            name: '1-feat-branch',
          },
          commentId: 42,
          deadIssue: true,
        },
      },
    }
    expect(() => dataStore.checkParsedFormat(data)).toThrow(ControlIssueDataDecodingError)
  })

  it('Not Valid: Wrong type in TODO: rawLine is number', async () => {
    const data = {
      version: '1',
      todoStates: {
        1: {
          featureBranch: {
            todos: [
              {
                rawLine: 1,
                todoText: 'feat branch todo',
                keyword: 'TODO',
                lineNumber: 2,
                issueNumber: 1,
                fileName: 'file',
                foundInCommit: 'xyz',
              },
            ],
            commitSha: 'asd',
            name: '1-feat-branch',
          },
          commentId: 42,
          deadIssue: true,
        },
      },
    }
    expect(() => dataStore.checkParsedFormat(data)).toThrow(ControlIssueDataDecodingError)
  })

})
