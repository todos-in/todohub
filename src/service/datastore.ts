import { gunzipSync, gzipSync } from 'node:zlib'
import { ControlIssueDataDecodingError, ControlIssueParsingError } from '../error/error.js'
import { DataStore, Id } from '../interfaces/datastore.js'
import { Logger } from '../interfaces/logger.js'
import { escapeMd } from '../util/escape-markdown.js'
import { RepoTodoStates } from '../model/model.repostate.js'
import GithubService from './github.js'
import { zRepoTodoStates } from '../model/validation.js'

export class TodohubControlIssueDataStore implements DataStore {

  private existingIssue?: {
    number: number,
    data: string,
    preTag: string,
    midTag: string,
    postTag: string,
    isClosed: boolean,
  }

  constructor(private repo: GithubService, private logger: Logger) {}

  async write(data: RepoTodoStates, _id: Id) {
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
    // TODO #70 sort by keys: Check/make sure that TODOs are always ordered when added before writing?
    const stringified = JSON.stringify(data, (key, value) => key.startsWith('_') ? undefined : value)
    const zipped = gzipSync(Buffer.from(stringified, 'utf-8'))
    const b64Encoded = zipped.toString('base64')
    return b64Encoded
  }

  private compose(data: RepoTodoStates) {
    const todoStates = Object.entries(data.getTodoStatesByIssueNr())
    let newMidTag = todoStates.length ? '\n### Tracked Issues:' : ''

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
        link = `Issue ${issueNr} (⚠️ No todohub comment found in associated)`
      }
      newMidTag += `\n* ${link}: *${todos.length}* open TODOs`
    }

    for (const [index, value] of footnotes.entries()) {
      newMidTag += `\n[^${index + 1}]: ${value}`
    }

    const strayTodos = data.getStrayTodoState()?.defaultBranch?.todos
    if (strayTodos && strayTodos.length) {
      newMidTag += '\n### Todos without Issue Reference:'
      for (const strayTodo of strayTodos) {
        const codeLink = `[link](${this.repo.baseUrl}/blob/${data.getLastUpdatedDefaultCommit()}/${strayTodo.fileName}#L${strayTodo.lineNumber})`
        newMidTag += `\n* [ ] \`${strayTodo.fileName}:${strayTodo.lineNumber}\`: ${escapeMd(strayTodo.rawLine)} <sup>${codeLink}</sup>`
      }
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