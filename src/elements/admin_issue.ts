import Repo from 'src/github-repo.js'
import TodohubDataTag from './admin_issue_tag.js'

// TODO move to config file
const TODOHUB_LABEL = {
  name: 'todohub',
  description: 'todohub control issue',
  color: '1D76DB',
}

export class TodohubAdminIssue {
  private preTag?: string
  private midTag?: string
  private postTag?: string
  data: TodohubDataTag
  private existingIssueNumber?: number
  private isClosed?: boolean

  private constructor(existingIssue?: {
    body: string;
    number: number;
    isClosed: boolean;
  }) {
    if (existingIssue) {
      this.existingIssueNumber = existingIssue.number
      this.isClosed = existingIssue.isClosed
      const components = this.parseContent(existingIssue.body)
      this.data = new TodohubDataTag(components.data)
      this.preTag = components.preTag
      this.midTag = components.midTag
      this.postTag = components.postTag
    } else {
      this.data = new TodohubDataTag()
    }
  }

  exists() {
    return this.existingIssueNumber !== undefined
  }

  private compose() {
    // TODO implement
    this.midTag = '\n### Tracked Issues:'
    for (const [issueNr, trackedIssue] of Object.entries(
      this.data.decodedData,
    )) {
      this.midTag += `\n* [Issue ${issueNr}](${issueNr}/#issuecomment-${trackedIssue.commentId || ''}): *${trackedIssue.todoState.length}* open TODOs`
    }
    this.midTag += '\n'
    return `${this.preTag || ''}<!--todohub_ctrl_issue_data="${this.data.encode()}"-->${this.midTag || ''}<!--todohub_ctrl_issue_end-->${this.postTag || ''}`
  }

  async write(repo: Repo) {
    // TODO implement
    if (this.existingIssueNumber) {
      return repo.updateIssue(
        this.existingIssueNumber,
        undefined,
        this.compose(),
      )
    }
    // TODO label is not created with right config (color + description)
    return repo.createIssue('Todohub Ctrl', this.compose(), [TODOHUB_LABEL])
    // TODO return updated issues - can be used to update the respective feature comments
  }

  private parseContent(commentBody: string) {
    const regex =
      /(?<preTag>[\s\S]*)<!--todohub_ctrl_issue_data="(?<data>[A-Za-z0-9+/=]*)"-->(?<midTag>[\s\S]*)<!--todohub_ctrl_issue_end-->(?<postTag>[\s\S]*)/
    const parsed = commentBody.match(regex)
    if (
      !parsed ||
      !parsed.groups ||
      parsed.groups.preTag === undefined ||
      parsed.groups.data === undefined ||
      parsed.groups.midTag === undefined ||
      parsed.groups.postTag === undefined
    ) {
      throw new Error(`Error parsing Todohub Issue: ${commentBody}`)
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
      return new TodohubAdminIssue({
        body: issue.body || '',
        number: issue.number,
        isClosed: issue.state === 'closed',
      })
    }
    return new TodohubAdminIssue()
  }

  // private async find() {
  //   // TODO implement

  // }

  // private async create() {
  //   // TODO implement
  // }
}
