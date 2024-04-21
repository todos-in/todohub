import { gunzipSync, gzipSync } from 'node:zlib'
import { ControlIssueDataDecodingError, ControlIssueParsingError } from '../error/error.js'
import { DataStore, Id } from '../interfaces/datastore.js'
import { Logger } from '../interfaces/logger.js'
import { escapeMd } from '../util/escape-markdown.js'
import { RepoTodoStates } from '../model/model.repostate.js'
import GithubService from './github.js'
import { zRepoTodoStates } from '../model/validation.js'
import { Todo } from 'model/model.todo.js'

type FileTree = { [fileName: string]: FileTree | Todo[] }

export class TodohubControlIssueDataStore implements DataStore {

  private existingIssue?: {
    number: number,
    data: string,
    preTag: string,
    midTag: string,
    postTag: string,
    isClosed: boolean,
  }

  constructor(private repo: GithubService, private logger: Logger) { }

  async write(data: RepoTodoStates, _id: Id) {
    // TODO #70 sort by keys: Check/make sure that TODOs are always ordered when added before writing?
    const composed = this.compose(data)
    if (this.existingIssue) {
      const updated = await this.repo.updateIssue(this.existingIssue.number, undefined, composed)
      return updated.data.number
    }
    const created = await this.repo.createPinnedIssue('Todohub Control Center', composed, ['todohub'])
    return created.data.number
  }

  async get(_id: Id) {
    const issues = await this.repo.findTodohubControlIssues()
    for (const issueCandidate of issues) {
      let parsedBody
      try {
        parsedBody = this.parseBodyParts(issueCandidate.body || '')
      } catch (err) {
        this.logger.debug(`Issue <${issueCandidate.number}> looks like a TodohubControlIssue Candidate, but failed to parse.`)
        continue
      }

      let decodedData
      try {
        decodedData = this.decodeFrom(parsedBody.data)

        this.existingIssue = Object.assign(parsedBody, {
          number: issueCandidate.number,
          isClosed: issueCandidate.state === 'closed',
        })

        this.logger.debug(`Found Todohub Control issue: <${issueCandidate.number}>`)
        return decodedData

      } catch (err) {
        this.logger.debug(`Issue <${issueCandidate.number}> looks like a TodohubControlIssue Candidate, data tag failed to be decoded.`)
        continue
      }
    }

    this.logger.debug('Did not find valid Todohub Control issue. Recreating state from scratch...')
    return RepoTodoStates.fromScratch()
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  checkParsedFormat(parsed: any): RepoTodoStates {
    try {
      return zRepoTodoStates.parse(parsed)
    } catch (err) {
      throw new ControlIssueDataDecodingError('Failed to parse data from Ctrl issue.', err instanceof Error ? err : undefined)
    }
  }

  private decodeFrom(data: string) {
    const b64Decoded = Buffer.from(data, 'base64')
    const unzipped = gunzipSync(b64Decoded)
    const parsed = JSON.parse(unzipped.toString('utf-8'))
    return this.checkParsedFormat(parsed)
  }

  private encode(data: RepoTodoStates) {
    const stringified = JSON.stringify(data, (key, value) => key.startsWith('_') ? undefined : value)
    const zipped = gzipSync(Buffer.from(stringified, 'utf-8'))
    const b64Encoded = zipped.toString('base64')
    return b64Encoded
  }

  private renderTodos(todos: Todo[], commit: string) {
    const buildFileTree = (todos: Todo[]) => {
      const fileTree: FileTree = {}

      for (const todo of todos) {
        const segments = todo.fileName.split('/')
        let currentNode = fileTree

        for (const [index, segment] of segments.entries()) {
          const isFile = index + 1 === segments.length
          let child = currentNode[segment]
          if (!child) {
            if (isFile) {
              child = [todo]
            } else {
              child = {}
            }
            currentNode[segment] = child
          } else {
            if (isFile) {
              (child as Todo[]).push(todo)
            }
          }
          currentNode = child as FileTree
        }
      }

      return fileTree
    }

    const flattenSingleNodes = (fileTree: FileTree, key?: string) => {
      for (const [fileName, subTree] of Object.entries(fileTree)) {
        if (key && fileName !== key) {
          continue
        }
        if (Array.isArray(subTree)) {
          continue
        }
        if (Object.keys(subTree).length === 1) {
          const [subFileName, subSubTree] = Object.entries(subTree)[0] as [string, FileTree | Todo[]]
          if (Array.isArray(subSubTree)) {
            continue
          }
          const compositeKey = `${fileName}/${subFileName}`
          const flattenedSubtree = {[compositeKey]: subSubTree}
          Object.assign(fileTree, flattenedSubtree)
          delete fileTree[fileName]
          flattenSingleNodes(fileTree, compositeKey)
        } else {
          flattenSingleNodes(subTree)
        }
      }
      return fileTree
    }

    const renderTree = (fileTree: FileTree) => {
      let markdown = ''

      // Sort All entries in a node By Type first and name second (leaf nodes (files) should show first)
      const nodes = Object.entries(fileTree)
        .sort(([nodeNameA, nodeA], [nodeNameB, nodeB]) => (Number(Array.isArray(nodeB))) - (Number(Array.isArray(nodeA))) || nodeNameA.localeCompare(nodeNameB))
      for (const [pathSegment, subTree] of nodes) {
        if (Array.isArray(subTree)) {
          // This is a leaf node (file) with a list of Todos within that file
          for (const todo of subTree) {
            const codeLink = `${this.repo.baseUrl}/blob/${commit}/${todo.fileName}#L${todo.lineNumber}`
            const fileNameWithoutPath = todo.fileName.split('/').pop()
            markdown += `* [ ] [\`${fileNameWithoutPath}:${todo.lineNumber}\`](${codeLink}): ${escapeMd(todo.rawLine)}\n`
          }
        } else {
          // This is a folder node
          markdown += '<details open>\n'
          markdown += `<summary><code>${pathSegment + '/'}</code></summary>\n\n`
          markdown += '<blockquote>\n\n'
          markdown += renderTree(subTree)
          markdown += '</blockquote>\n'
          markdown += '</details>\n\n'
        }

      }

      return markdown
    }

    const fileTree = buildFileTree(todos)
    const flattenedTree = flattenSingleNodes(fileTree)
    const renderedTodos = renderTree(flattenedTree)
    return renderedTodos
  }

  private compose(data: RepoTodoStates) {
    const todoStates = Object.entries(data.getTodoStatesByIssueNr())
    let newMidTag = todoStates.length ? '\n### Tracked Issues' : ''

    const footnotes: string[] = []
    for (const [issueNr, todoState] of todoStates) {
      const todos = todoState.featureBranch?.todos || todoState.defaultBranch?.todos
      if (!todos || !todos.length) {
        continue
      }
      let link = ''
      if (todoState.commentId) {
        link = `[Issue ${issueNr}](${issueNr}/#issuecomment-${todoState.commentId || ''})`
      } else if (todoState.deadIssue) {
        footnotes.push(`Associated issue ${issueNr} seems to have been deleted permanently. Consider creating a new issue and migrating all open Todos in code referencing issue number ${issueNr}.`)
        const currentFootnoteIndex = footnotes.length
        link = `Issue ${issueNr} (❗[^${currentFootnoteIndex}])`
      } else {
        link = `Issue ${issueNr} (⚠️ No todohub comment found in associated issue)`
      }
      newMidTag += `\n* ${link}: *${todos.length}* open TODOs`
    }

    for (const [index, value] of footnotes.entries()) {
      newMidTag += `\n[^${index + 1}]: ${value}`
    }

    const strayTodos = data.getStrayTodoState()?.defaultBranch?.todos

    if (strayTodos && strayTodos.length) {
      newMidTag += '\n### Todos without Issue Reference\n'
      newMidTag += `<details>
<summary><sub>:exclamation: Info<sub></summary>

> TODOs should reference an existing issue in github to prevent them from getting lost: Instead of \`TODO fix this\`, create an Issue for the problem on Github and reference the issue number: \`TODO #42 fix this\`.
</details>\n\n`
      newMidTag += this.renderTodos(strayTodos, data.getLastUpdatedDefaultCommit() || '')
    }

    newMidTag += `\n\n<sub>**Last updated:** ${data.getLastUpdatedDefaultCommit()}</sub>`

    return `${this.existingIssue?.preTag || ''}<!--todohub_ctrl_issue_data="${this.encode(data)}"-->${newMidTag || ''}<!--todohub_ctrl_issue_end-->${this.existingIssue?.postTag || ''}`
  }

  parseBodyParts(issueBody: string) {
    const regex =
      /(?<preTag>[\s\S]*)<!--todohub_ctrl_issue_data="(?<data>[A-Za-z0-9+/=]*)"-->(?<midTag>[\s\S]*)<!--todohub_ctrl_issue_end-->(?<postTag>[\s\S]*)/
    const parsed = issueBody.match(regex)
    if (
      !parsed ||
      !parsed.groups ||
      parsed.groups.preTag === undefined ||
      parsed.groups.data === undefined ||
      parsed.groups.midTag === undefined ||
      parsed.groups.postTag === undefined
    ) {
      throw new ControlIssueParsingError(`Error parsing Todohub Control Issue: <${issueBody}>`)
    }
    return parsed.groups as {
      preTag: string;
      data: string;
      midTag: string;
      postTag: string;
    }
  }
}