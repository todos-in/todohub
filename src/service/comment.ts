import { TodoState } from '../interfaces/data.js'
import { Logger } from '../interfaces/logger.js'
import GithubService from './github.js'
import { escapeMd } from '../util/escape-markdown.js'
import { assertGithubError } from '../error/error.js'

export class GithubCommentFactory {
  constructor(private repo: GithubService, private logger: Logger) { }

  make(issueNr: number, data: TodoState) {
    return new GithubComment(this.repo, this.logger, issueNr, data)
  }
}

class GithubComment {
  constructor(
    private repo: GithubService,
    private logger: Logger,
    private issueNr: number,
    private data: TodoState,
  ) { }

  // TODO #93 rename class? This is not directly related to the comment
  async reopenIssueWithOpenTodos() {
    if (this.data.todos.length) {
      this.logger.debug(`Opening issue <${this.issueNr}>...`)
      try {
        return await this.repo.updateIssue(this.issueNr, undefined, undefined, 'open')
      } catch (err) {
        assertGithubError(err)
        if (err.status === 410 || err.status === 404) {
          this.logger.warning(`Error (re)opening issue <${this.issueNr}>. Issue does not exist or was permanently deleted.`)
        } else if (err.status === 422) {
          this.logger.warning(`Error (re)opening issue <${this.issueNr}>. Possibly a pull request, which cannot be reopened due to the respective branch being deleted.`)
        } else {
          throw err
        }
      }
    }
  }

  // TODO #93 this mutates data (which is probably what we need, but should be documented and clear or data should be returned)
  async write() {
    const existingCommentId = this.data.commentId
    const composedComment = this.composeTrackedIssueComment()

    if (existingCommentId) {
      this.logger.debug(`Updating comment on issue <${this.issueNr}-${existingCommentId}>...`)
      try {
        return await this.repo.updateComment(existingCommentId, composedComment)
      } catch (err) {
        assertGithubError(err)
        if (err.status === 404) {
          this.logger.warning(`Failed to update Issue Comment <${this.issueNr}-${existingCommentId}>. Trying to create new Comment instead...`)
          this.data.commentId = undefined
        } else {
          throw err
        }
      }
    }
    try {
      this.logger.debug(`Adding new comment to issue ${this.issueNr}...`)
      const created = await this.repo.createComment(this.issueNr, composedComment)
      this.data.commentId = created.data.id
      return created
    } catch (err) {
      assertGithubError(err)
      if (err.status === 404 || err.status === 410) {
        this.logger.warning(`Error creating comment: It appears Issue <${this.issueNr}> does not exist.
        If the Issue has been deleted permanently, consider creating a new issue and migrating all Todos in your code referencing issue <${this.issueNr}> to the new issue.`)
        this.data.deadIssue = true
      } else {
        throw err
      }
    }
  }

  composeTrackedIssueComment() {
    let composed = this.data.todos.length ? '#### TODOs:' : 'No Open Todos'
    for (const todo of this.data.todos) {
      const link = `[link](${this.repo.baseUrl}/blob/${this.data.commitSha}/${todo.fileName}#L${todo.lineNumber})`
      composed += `\n* [ ] \`${todo.fileName}:${todo.lineNumber}\`: ${escapeMd(todo.rawLine)} <sup>${link}</sup>`
    }
    composed += `\n\n<sub>**Last set:** ${this.data.commitSha} | **Tracked Branch:** \`${escapeMd(this.data.trackedBranch)}\`</sub>`

    return composed
  }
}