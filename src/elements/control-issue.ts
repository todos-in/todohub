import Repo from 'src/github-repo.js'
import TodohubData from './control-issue-data.js'

// TODO move to config file
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
  private existingIssueNumber?: number
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
    this.midTag = '\n### Tracked Issues:'
    for (const [issueNr, trackedIssue] of Object.entries(this.data.getTodosWithIssueReference())) {
      let link = ''
      if (trackedIssue.commentId) {
        link = `[Issue ${issueNr}](${issueNr}/#issuecomment-${trackedIssue.commentId || ''})`
      } else {
        link = `Issue ${issueNr} (No associated issue found)`
      }
      this.midTag += `\n* ${link}: *${trackedIssue.todoState.length}* open TODOs`
    }
    this.midTag += '\n### Todos without Issue Reference:'

    const issueWORefernce = this.data.getTodosWithoutIssueReference()
    if (issueWORefernce) {
      for (const todo of issueWORefernce.todoState) {
        // TODO #74 make sure todos dont contain characters that break the comment
        this.midTag += `\n* [ ] \`${todo.fileName}\`${todo.lineNumber ? `:${todo.lineNumber}` : ''}: ${todo.keyword} ${todo.todoText} ${todo.link ? `(${todo.link})` : ''}`
      }
    }

    return `${this.preTag || ''}<!--todohub_ctrl_issue_data="${this.data.encode()}"-->${this.midTag || ''}<!--todohub_ctrl_issue_end-->${this.postTag || ''}`
  }

  async write() {
    if (this.existingIssueNumber) {
      return this.repo.updateIssue(this.existingIssueNumber,  undefined, this.compose())
    }
    // TODO label is not created with right config (color + description)
    return this.repo.createIssue('Todohub Ctrl', this.compose(), [TODOHUB_LABEL])
    // TODO return updated issues - can be used to update the respective feature comments
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
      // TODO handle error and keep searching if parsing fails?
      return new TodohubControlIssue(repo, {
        body: issue.body || '',
        number: issue.number,
        isClosed: issue.state === 'closed',
      })
    }
    return new TodohubControlIssue(repo)
  }
}
