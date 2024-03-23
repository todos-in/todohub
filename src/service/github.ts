import { createGunzip } from 'node:zlib'
import * as path from 'node:path'
import { ReadableStream } from 'node:stream/web'
import stream from 'node:stream'
import * as tar from 'tar-stream'
import { ignoreWrapper, Ignore } from 'ignore-wrapper'
import { SplitLineStream } from '../util/line-stream.js'
import { assertGithubError } from '../error/error.js'
import { Octokit } from 'octokit'
import { OctokitGetter } from '../interfaces/octokit.js'
import { Logger } from '../interfaces/logger.js'
import { EnvironmentService } from './environment.js'
import { FindTodoStreamFactory } from '../util/find-todo-stream.js'
import { Todo } from '../model/model.todo.js'

// TODO #77 use graphql where possible to reduce data transfer
// TODO #63 handle rate limits (primary and secondary)
export default class GithubService {
  octokit: Octokit
  repo: string
  owner: string
  baseUrl: string

  constructor(
    private octokitGetter: OctokitGetter,
    private envService: EnvironmentService,
    private logger: Logger,
    private findTodoStreamFactory: FindTodoStreamFactory) {
    const env = envService.getEnv()
    this.owner = env.repoOwner
    this.repo = env.repo
    this.octokit = octokitGetter(env.githubToken, { userAgent: 'todohub/v1' })
    this.baseUrl = `https://github.com/${this.owner}/${this.repo}`
  }

  private async getTodoIgnoreFile(ref?: string) {
    let todoIgnoreFileRaw
    try {
      todoIgnoreFileRaw = await this.octokit.rest.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        ref,
        path: '.todoignore',
        headers: {
          accept: 'application/vnd.github.raw+json',
        },
      })
    } catch (err) {
      assertGithubError(err)
      if (err.status === 404) {
        this.logger.debug('No ".todoignore" file found.')
        return
      }
      throw err
    }
    const contents = todoIgnoreFileRaw.data.toString()
    this.logger.debug(`".todoignore" file found. Parsing contents: <${contents.substring(0, 200)}>...`)
    return ignoreWrapper().add(contents)
  }

  private async getTarballStream(ref?: string) {
    const tarballUrl = await this.octokit.rest.repos.downloadTarballArchive({
      owner: this.owner,
      repo: this.repo,
      ref: ref || '',
      request: {
        parseSuccessResponseBody: false,
      },
    })

    return stream.Readable.fromWeb(tarballUrl.data as ReadableStream)
  }

  private async extractTodosFromTarGz(
    tarBallStream: stream.Readable,
    issueNr?: number,
    ignore?: Ignore,
  ): Promise<Todo[]> {
    const extractStream = tar.extract()
    const unzipStream = createGunzip()

    const todos: Todo[] = []

    tarBallStream.pipe(unzipStream).pipe(extractStream)
    // TODO #80 check and test event & error handling in streams (are they closed properly?) check for memory leaks
    // response.on('end', () => {
    //   // testStream.end();
    // });

    return new Promise((resolve, reject) => {
      // TODO #80 check and test event & error handling 
      unzipStream.on('error', (err) => reject(err))

      // TODO #80 check and test event & error handling
      extractStream.on('error', (err: Error) => reject(err))

      extractStream.on('finish', () => {
        this.logger.info('Todos extraction completed successfully.')
        return resolve(todos)
      })

      extractStream.on('entry', (header, stream, next) => {
        if (header.type !== 'file') {
          stream.resume()
          return next()
        }

        const filePathParts = header.name.split(path.sep)
        filePathParts.shift()
        const fileName = path.join(...filePathParts)

        if (ignore?.ignores(fileName)) {
          this.logger.info(`Skipping <${fileName}> due to '.todoignore' rule...`)
          stream.resume()
          return next()
        }

        this.logger.debug(`Extracting Todos from file <${fileName}>...`)

        const splitLineStream = new SplitLineStream()
        const findTodosStream = this.findTodoStreamFactory.make(todos, fileName, issueNr)

        splitLineStream.on('end', () => findTodosStream.end())
        // TODO #59 handle errors in splitLineStream, todoStream: https://stackoverflow.com/questions/21771220/error-handling-with-node-js-streams

        stream.pipe(splitLineStream).pipe(findTodosStream)
        stream.on('error', () => {
          this.logger.warning(`Error extracting Todos from file: <${fileName}>`)
          splitLineStream.end()
          next()
        })
        stream.on('end', () => {
          splitLineStream.end()
          next()
        })
      })
    })
  }

  /**
   * Searches for all "TODOs" occurrences in a certain git ref
   * @param commitSha commitSha of the git state to be searched
   * @param issueNr if set, it will only seach occurences that reference this issueNr, such as "TOD‎O #18 do this", otherwise it will search all "TODOs", whether they refernce any issue or none
  * @returns TodoState
   */
  async getTodosFromGitRef(
    commitSha: string,
    issueNr?: number,
  ) {
    // TODO #62 parallelize
    const tarStream = await this.getTarballStream(commitSha)
    const ignore = await this.getTodoIgnoreFile()
    const todos = await this.extractTodosFromTarGz(
      tarStream,
      issueNr,
      ignore,
    )
    return todos.map((todo) => Object.assign(todo, { foundInCommit: commitSha }))
  }

  /**
   * Finds all branches in repository which start with `${number}-` which are branches that are potentially associated with an Issue on Github 
   * @returns Feature Branches
   */
  async getFeatureBranches() {
    const isFeatureBranch = (branch: { name: string }) =>
      /[0-9]+-.*/.test(branch.name)

    const featureBranches: { name: string; commit: { sha: string } }[] = []
    const branchesPages = this.octokit.paginate.iterator(
      this.octokit.rest.repos.listBranches,
      {
        owner: this.owner,
        repo: this.repo,
        per_page: 100,
      },
    )
    for await (const branchesPage of branchesPages) {
      featureBranches.push(...branchesPage.data.filter(isFeatureBranch))
    }
    return featureBranches
  }

  async getFeatureBranchesAheadOf(base: string, heads: string[]) {
    // TODO #63 concurrent requests could be a problem for secondary rate limits: https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api?apiVersion=2022-11-28#about-secondary-rate-limits
    const comparisons = await Promise.all(heads.map((head) => this.compareCommits(base, head)))

    const featureBranchesAheadOf = []
    for (let i = 0; i < comparisons.length; i++) {
      const ahead = comparisons[i]?.data.ahead_by
      if (ahead && ahead > 0) {
        featureBranchesAheadOf.push(heads[i] as string)
      }
    }
    return featureBranchesAheadOf
  }

  private async compareCommits(base: string, head: string) {
    // TODO #77 these are potentially traffic intensive requests since they include the whole diff
    return this.octokit.rest.repos.compareCommits({
      owner: this.owner,
      repo: this.repo,
      base,
      head,
    })
  }

  async findTodohubControlIssues() {
    const todohubIssues = await this.octokit.rest.search.issuesAndPullRequests({
      per_page: 1,
      q: `todohub_ctrl_issue_data label:todohub is:issue in:body repo:${this.owner}/${this.repo}`,
    })
    if (todohubIssues.data.total_count > 1) {
      this.logger.warning('More than one candidate for Todohub Control Issue found (matching "todohub_ctrl_issue_data") - Check and consider closing stale Todohub Control issues.')
    }
    return todohubIssues.data.items
  }

  async updateComment(commentId: number, body: string) {
    return this.octokit.rest.issues.updateComment({
      owner: this.owner,
      repo: this.repo,
      comment_id: commentId,
      body,
    })
  }

  async createComment(issueNumber: number, body: string) {
    return this.octokit.rest.issues.createComment({
      owner: this.owner,
      repo: this.repo,
      issue_number: issueNumber,
      body,
    })
  }

  async createIssue(
    title: string,
    body: string,
    labels?: string[],
  ) {
    return this.octokit.rest.issues.create({
      owner: this.owner,
      repo: this.repo,
      title,
      body,
      labels,
    })
  }

  async createPinnedIssue(
    title: string,
    body: string,
    labels?: string[],
  ) {
    const issue = await this.createIssue(title, body, labels)
    await this.pinIssue(issue.data.node_id)
    return issue
  }

  async pinIssue(issueId: string) {
    return this.octokit.graphql(`mutation Pin($issueId: ID!) {
      pinIssue(input: {issueId: $issueId }) { issue { id } } 
    }`, { issueId })
  }

  async updateIssue(
    issueNumber: number,
    title?: string,
    body?: string,
    state?: 'open' | 'closed',
  ) {
    return this.octokit.rest.issues.update({
      owner: this.owner,
      repo: this.repo,
      issue_number: issueNumber,
      title,
      body,
      state,
    })
  }
}
