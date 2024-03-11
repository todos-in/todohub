import Repo from 'src/github-repo.js'
import TodohubData from './control-issue-data.js'
import * as core from '@actions/core'
import { ControlIssueParsingError, assertGithubError } from 'src/error.js'

// TODO #60 move to config file
const TODOHUB_LABEL = {
  name: 'todohub',
  description: 'todohub control issue',
  color: '1D76DB',
}

export class TodohubControlIssue {
  private preTag?: string
  private midTag?: string
  private postTag?: string
  data: TodohubData
  existingIssueNumber?: number
  private existingIsClosed?: boolean
  private repo: Repo

  private constructor(repo: Repo, existingIssue?: {
    body: string;
    number: number;
    isClosed: boolean;
  }) {
    this.repo = repo
    if (existingIssue) {
      this.existingIssueNumber = existingIssue.number
      this.existingIsClosed = existingIssue.isClosed
      const components = this.parseContent(existingIssue.body)
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
    const todosWithIssueReference = Object.entries(this.data.getTodosWithIssueReference())
    this.midTag = todosWithIssueReference.length ? '\n### Tracked Issues:' : ''

    const footnotes: string[] = []
    for (const [issueNr, trackedIssue] of todosWithIssueReference) {
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

    const issueWORefernce = this.data.getTodosWithoutIssueReference()
    if (issueWORefernce && issueWORefernce.todoState.length) {
      this.midTag += '\n### Todos without Issue Reference:'
      for (const todo of issueWORefernce.todoState) {
        // TODO #74 make sure todos dont contain characters that break the comment
        this.midTag += `\n* [ ] \`${todo.fileName}${todo.lineNumber ? `:${todo.lineNumber}` : ''}\`: ${todo.keyword} ${todo.todoText} ${todo.link ? `(${todo.link})` : ''}`
      }
    }

    return `${this.preTag || ''}<!--todohub_ctrl_issue_data="${this.data.encode()}"-->${this.midTag || ''}<!--todohub_ctrl_issue_end-->${this.postTag || ''}`
  }

  async write() {
    if (this.existingIssueNumber) {
      return this.repo.updateIssue(this.existingIssueNumber, undefined, this.compose())
    }
    // TODO #60 get this issue title and label settings from config from input?
    // TODO #60 label is not created with right config (color + description)
    return this.repo.createPinnedIssue('Todohub Control Center', this.compose(), [TODOHUB_LABEL])
  }

  async reopenIssueWithOpenTodos(issueNr: number) {
    if (!this.data.isEmpty(issueNr)) {
      core.debug(`Opening issue ${issueNr}...`)
      try {
        await this.repo.updateIssue(
          issueNr,
          undefined,
          undefined,
          'open',
        )
      } catch (err: unknown) {
        assertGithubError(err)
        if (err.status === 410) {
          core.warning(`Error (re)opening issue ${issueNr}. Issue does not exist.`)
        } else {
          throw err
        }
      }
    }
  }

  async writeComment(issueNr: number) {
    const existingCommentId = this.data.getExistingCommentId(issueNr)
    const composedComment = this.data.composeTrackedIssueComment(issueNr)

    if (existingCommentId) {
      core.debug(`Updating comment on issue ${issueNr}-${existingCommentId}...`)
      try {
        await this.repo.updateComment(existingCommentId, composedComment)
        return
      } catch (err) {
        assertGithubError(err)
        if (err.status === 404) {
          core.warning(`Failed to update Issue Comment ${issueNr}-${existingCommentId}. Trying to create new Comment instead...`)
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
        core.warning(`Error creating comment: It appears Issue ${issueNr} does not exist.
        If the Issue has been deleted permanently, consider creating a new issue and migrating all Todos in your code referencing issue ${issueNr} to the new issue.`)
        this.data.setDeadIssue(issueNr)
      } else {
        throw err
      }
    }
  }

  private parseContent(issueBody: string) {
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
      throw new ControlIssueParsingError(`Error parsing Todohub Control Issue: ${issueBody}`)
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
