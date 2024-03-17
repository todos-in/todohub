import { ControlIssueParsingError } from '../error/error.js'
import { DataStore, Id } from '../interfaces/datastore.js'
import { Logger } from '../interfaces/logger.js'
import { escapeMd } from '../util/escape-markdown.js'
import { TodohubControlIssueData } from './data.js'
import GithubService from './github.js'

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

  async write(data: TodohubControlIssueData, _id: Id) {
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
        decodedData = TodohubControlIssueData.decodeFrom(parsedBody.data, issueCandidate.number)

        this.existingIssue = Object.assign(parsedBody, {
          number: issueCandidate.number,
          isClosed: issueCandidate.state === 'closed',
        })

        return decodedData

      } catch (err) {
        this.logger.debug(`Issue <${issueCandidate.number}> looks like a TodohubControlIssue Candidate, data tag failed to be decoded.`)
        continue
      }
    }
    return TodohubControlIssueData.fromScratch()
  }

  private compose(data: TodohubControlIssueData) {
    const todoStates = Object.entries(data.getIssuesTodoStates())
    let newMidTag = todoStates.length ? '\n### Tracked Issues:' : ''

    const footnotes: string[] = []
    for (const [issueNr, todoState] of todoStates) {
      if (!todoState.todos.length) {
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
      newMidTag += `\n* ${link}: *${todoState.todos.length}* open TODOs`
    }

    for (const [index, value] of footnotes.entries()) {
      newMidTag += `\n[^${index + 1}]: ${value}`
    }

    const strayTodos = data.getStrayTodoState()
    if (strayTodos && strayTodos.todos.length) {
      newMidTag += '\n### Todos without Issue Reference:'
      for (const strayTodo of strayTodos.todos) {
        const codeLink = `[link](${this.repo.baseUrl}/blob/main/${strayTodo.fileName}#L${strayTodo.lineNumber})`
        newMidTag += `\n* [ ] \`${strayTodo.fileName}:${strayTodo.lineNumber}\`: ${escapeMd(strayTodo.rawLine)} <sup>${codeLink}</sup>`
      }
    }

    newMidTag += `\n\n<sub>**Last updated:** ${data.getLastUpdatedCommit()}</sub>`

    this.logger.debug('Encoding: data for control issue: ' + JSON.stringify(data))
    return `${this.existingIssue?.preTag || ''}<!--todohub_ctrl_issue_data="${data.encode()}"-->${newMidTag || ''}<!--todohub_ctrl_issue_end-->${this.existingIssue?.postTag || ''}`
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