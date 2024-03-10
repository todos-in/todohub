import Repo from 'src/github-repo.js'
import TodohubData from './control-issue-data.js'
import * as core from '@actions/core'

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

    for (const [issueNr, trackedIssue] of todosWithIssueReference) {
      let link = ''
      if (trackedIssue.commentId) {
        link = `[Issue ${issueNr}](${issueNr}/#issuecomment-${trackedIssue.commentId || ''})`
      } else {
        link = `Issue ${issueNr} (No associated issue found)`
      }
      this.midTag += `\n* ${link}: *${trackedIssue.todoState.length}* open TODOs`
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
    // TODO #61 return updated issues - can be used to update the respective feature comments
  }

  async updateTrackedIssueState(issueNr: number) {
    if (!this.data.isEmpty(issueNr)) {
      core.debug(`Opening issue ${issueNr}...`)
      try {
        await this.repo.updateIssue(
          issueNr,
          undefined,
          undefined,
          'open',
        )  
      } catch (err) {
        // TODO #59 check if error is actually because of non existant issue - otherwise throw?
        core.warning(`Error (re)opening issue ${issueNr}. Are there Todos with reference to issue ${issueNr}, which does not exist?`)
        if (err instanceof Error) {
          core.warning(err.message)
        }
      }
    }
  }

  async writeComment(issueNr: number) {
    const existingCommentId = this.data.getExistingCommentId(issueNr)
    const composedComment = this.data.composeTrackedIssueComment(issueNr)

    if (existingCommentId) {
      // TODO #64 add state hash to check whether anything needs to be updated?
      // TODO #59 handle: comment was deleted
      core.debug(`Updating comment on issue ${issueNr}/${existingCommentId}...`)
      await this.repo.updateComment(existingCommentId, composedComment)
    } else {
      // TODO #59handle: issue doesnt exist
      core.debug(`Adding new comment to issue ${issueNr}...`)
      const created = await this.repo.createComment(issueNr, composedComment)
      this.data.setCommentId(issueNr, created.data.id)
      try {
        core.debug(`Adding new comment to issue ${issueNr}...`)
        const created = await this.repo.createComment(issueNr, composedComment)
        this.data.setCommentId(issueNr, created.data.id)
      } catch (err) {
        // TODO #59 handle: issue doesnt exist? Create?
        // TODO #59 check if error is actually because of non existant issue - otherwise throw?
        core.warning(`Error creating comment. Does issue ${issueNr} exist?`)
        if (err instanceof Error) {
          core.warning(err.message)
        }
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
      throw new Error(`Error parsing Todohub Issue: ${issueBody}`)
    }
    return parsed.groups as {
      preTag: string;
      data: string;
      midTag: string;
      postTag: string;
    }
  }

  static async get(repo: Repo) {
    const issue = await repo.findTodoHubIssue()
    if (issue) {
      // TODO #59 handle error and keep searching if parsing fails?
      return new TodohubControlIssue(repo, {
        body: issue.body || '',
        number: issue.number,
        isClosed: issue.state === 'closed',
      })
    }
    return new TodohubControlIssue(repo)
  }
}
