import { TTodo } from '../model/validation.js'
import { Logger } from '../interfaces/logger.js'
import GithubService from './github.js'
import { escapeMd } from '../util/escape-markdown.js'
import { assertGithubError } from '../error/error.js'

export class GithubCommentFactory {
  constructor(private repo: GithubService, private logger: Logger) { }

  make(issueNr: number, commentId: number | undefined, commitSha: string, refName: string, todos: TTodo[]) {
    return new GithubIssueComment(this.repo, this.logger, issueNr, commentId, commitSha, refName, todos)
  }
}

class GithubIssueComment {
  constructor(
    private repo: GithubService,
    private logger: Logger,
    private issueNr: number,
    private commentId: number | undefined,
    private commitSha: string,
    private refName: string,
    private todos: TTodo[],
  ) { }

  async reopenIssueWithOpenTodos() {
    if (this.todos.length) {
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

  /**
   * If a comment already exists, will try to overwrite. Otherwise tries to create a new comment on the issue.
   * Impportant: Also manuipulates its own data to add commentId, if it was created or set deadIssue if issue was not found
   * 
   * @returns Updated or created comment if successful
   */
  async write() {
    const composedComment = this.composeTrackedIssueComment()

    if (this.commentId) {
      this.logger.debug(`Updating comment on issue <${this.issueNr}-${this.commentId}>...`)
      try {
        await this.repo.updateComment(this.commentId, composedComment)
        return this.commentId
      } catch (err) {
        assertGithubError(err)
        if (err.status === 404) {
          this.logger.warning(`Failed to update Issue Comment <${this.issueNr}-${this.commentId}>. Trying to create new Comment instead...`)
        } else {
          throw err
        }
      }
    }
    try {
      this.logger.debug(`Adding new comment to issue ${this.issueNr}...`)
      const created = await this.repo.createComment(this.issueNr, composedComment)
      return created.data.id
    } catch (err) {
      assertGithubError(err)
      if (err.status === 404 || err.status === 410) {
        this.logger.warning(`Error creating comment: It appears Issue <${this.issueNr}> does not exist.
        If the Issue has been deleted permanently, consider creating a new issue and migrating all Todos in your code referencing issue <${this.issueNr}> to the new issue.`)
        return undefined
      } else {
        throw err
      }
    }
  }

  composeTrackedIssueComment() {
    let composed = this.todos.length ? '#### TODOs:' : 'No Open Todos'
    for (const todo of this.todos) {
      const link = `[link](${this.repo.baseUrl}/blob/${this.commitSha}/${todo.fileName}#L${todo.lineNumber})`
      composed += `\n* [ ] \`${todo.fileName}:${todo.lineNumber}\`: ${escapeMd(todo.rawLine)} <sup>${link}</sup>`
    }
    composed += `\n\n<sub>**Last set:** ${this.commitSha} | **Tracked Branch:** \`${escapeMd(this.refName)}\`</sub>`

    return composed
  }
}
