import Repo from '../service/github.js' // TODO #93 Needs its own resolution
import TodohubData from './control-issue-data.js'
import * as core from '@actions/core' // TODO #93 Needs its own resolution
import { ControlIssueParsingError, assertGithubError } from '../error/error.js'
import { escapeMd } from '../util/escape-markdown.js'

// TODO #93 make this a factory

export class TodohubControlIssue {
  private preTag?: string
  private midTag?: string
  private postTag?: string
  data: TodohubData
  existingIssueNumber?: number
  private existingIsClosed?: boolean
  private repo: Repo
  private baseRepoUrl: string

  private constructor(repo: Repo, existingIssue?: {
    body: string;
    number: number;
    isClosed: boolean;
  }) {
    this.repo = repo
    this.baseRepoUrl = `https://github.com/${this.repo.owner}/${this.repo.repo}`
    if (existingIssue) {
      this.existingIssueNumber = existingIssue.number
      this.existingIsClosed = existingIssue.isClosed
      const components = TodohubControlIssue.parseContent(existingIssue.body)
      this.data = new TodohubData(components.data)
      this.preTag = components.preTag
      this.midTag = components.midTag
      this.postTag = components.postTag
    } else {
      this.data = new TodohubData()
    }
  }

  exists() {
    return this.existingIssueNumber !== undefined
  }

  private compose() {
    const todos = Object.entries(this.data.getIssueTodos())
    this.midTag = todos.length ? '\n### Tracked Issues:' : ''

    const footnotes: string[] = []
    for (const [issueNr, trackedIssue] of todos) {
      if (!trackedIssue.todoState.length) {
        continue
      }
      let link = ''
      if (trackedIssue.commentId) {
        link = `[Issue ${issueNr}](${issueNr}/#issuecomment-${trackedIssue.commentId || ''})`
      } else if (trackedIssue.deadIssue) {
        footnotes.push(`Associated issue ${issueNr} seems to have been deleted permanently. Consider creating a new issue and migrating all open Todos in code referencing issue number ${issueNr}.`)
        const currentFootnoteIndex = footnotes.length
        link = `Issue ${issueNr} (❗[^${currentFootnoteIndex}])`
      } else {
        link = `Issue ${issueNr} (⚠️ No todohub comment found in associated)`
      }
      this.midTag += `\n* ${link}: *${trackedIssue.todoState.length}* open TODOs`
    }

    for (const [index, value] of footnotes.entries()) {
      this.midTag += `\n[^${index + 1}]: ${value}`
    }

    const strayTodos = this.data.getStrayTodos()
    if (strayTodos && strayTodos.todoState.length) {
      this.midTag += '\n### Todos without Issue Reference:'
      for (const strayTodo of strayTodos.todoState) {
        const codeLink = `[click](${this.baseRepoUrl}/blob/main/${strayTodo.fileName}#L${strayTodo.lineNumber})`
        this.midTag += `\n* [ ] \`${strayTodo.fileName}:${strayTodo.lineNumber}\`: ${escapeMd(strayTodo.rawLine)} <sup>${codeLink}</sup>`
      }
    }

    this.midTag += `\n\n<sub>**Last updated:** ${this.data.getLastUpdatedCommit()}</sub>`

    return `${this.preTag || ''}<!--todohub_ctrl_issue_data="${this.data.encode()}"-->${this.midTag || ''}<!--todohub_ctrl_issue_end-->${this.postTag || ''}`
  }

  async write() {
    if (this.existingIssueNumber) {
      return this.repo.updateIssue(this.existingIssueNumber, undefined, this.compose())
    }
    return this.repo.createPinnedIssue('Todohub Control Center', this.compose(), ['todohub'])
  }

  async reopenIssueWithOpenTodos(issueNr: number) {
    if (!this.data.isEmpty(issueNr)) {
      core.debug(`Opening issue <${issueNr}>...`)
      try {
        await this.repo.updateIssue(
          issueNr,
          undefined,
          undefined,
          'open',
        )
      } catch (err) {
        assertGithubError(err)
        if (err.status === 410 || err.status === 404) {
          core.warning(`Error (re)opening issue <${issueNr}>. Issue does not exist or was permanently deleted.`)
        } else if (err.status === 422) {
          core.warning(`Error (re)opening issue <${issueNr}>. Possibly a pull request, which cannot be reopened due to the respective branch being deleted.`)
        } else {
          throw err
        }
      }
    }
  }

  async writeComment(issueNr: number) {
    const existingCommentId = this.data.getExistingCommentId(issueNr)
    const composedComment = this.data.composeTrackedIssueComment(issueNr, this.baseRepoUrl)

    if (existingCommentId) {
      core.debug(`Updating comment on issue <${issueNr}-${existingCommentId}>...`)
      try {
        await this.repo.updateComment(existingCommentId, composedComment)
        return
      } catch (err) {
        assertGithubError(err)
        if (err.status === 404) {
          core.warning(`Failed to update Issue Comment <${issueNr}-${existingCommentId}>. Trying to create new Comment instead...`)
          this.data.deleteExistingCommentId(issueNr)
        } else {
          throw err
        }
      }
    }
    try {
      core.debug(`Adding new comment to issue ${issueNr}...`)
      const created = await this.repo.createComment(issueNr, composedComment)
      this.data.setCommentId(issueNr, created.data.id)
    } catch (err) {
      assertGithubError(err)
      if (err.status === 404 || err.status === 410) {
        core.warning(`Error creating comment: It appears Issue <${issueNr}> does not exist.
        If the Issue has been deleted permanently, consider creating a new issue and migrating all Todos in your code referencing issue <${issueNr}> to the new issue.`)
        this.data.setDeadIssue(issueNr)
      } else {
        throw err
      }
    }
  }

  static parseContent(issueBody: string) {
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

  static async get(repo: Repo) {
    const issue = await repo.findTodohubControlIssue()
    // TODO #59 handle error if parsing fails and keep searching?
    if (issue) {
      return new TodohubControlIssue(repo, {
        body: issue.body || '',
        number: issue.number,
        isClosed: issue.state === 'closed',
      })
    }
    return new TodohubControlIssue(repo)
  }
}
