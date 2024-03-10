import { request } from 'node:https'
import { createGunzip } from 'node:zlib'
import { IncomingMessage } from 'node:http'
import * as path from 'node:path'
import * as github from '@actions/github'
import { GitHub } from '@actions/github/lib/utils.js'
import * as tar from 'tar-stream'
import ignore from 'ignore'
import TodoState from './todo-state.js'
import { SplitLineStream } from './util/line-stream.js'
import { FindTodoStream } from './util/find-todo-stream.js'
import * as core from '@actions/core'

// TODO #77 use graphql where possible to reduce data transfer
// TODO #63 handle rate limits (primary and secondary)
export default class Repo {
  API_HITS = 0
  githubToken: string
  octokit: InstanceType<typeof GitHub>
  owner: string
  repo: string

  constructor(githubToken: string, owner: string, repo: string) {
    this.githubToken = githubToken
    this.octokit = github.getOctokit(githubToken, { userAgent: 'todohub/v1' })
    this.owner = owner
    this.repo = repo
  }

  private async getTodoIgnoreFile(ref?: string) {
    let todoIgnoreFileRaw
    try {
      todoIgnoreFileRaw = await this.octokit.request(
        'GET /repos/{owner}/{repo}/contents/.todoignore{?ref}',
        {
          owner: this.owner,
          repo: this.repo,
          ref,
          headers: {
            accept: 'application/vnd.github.raw+json',
          },
        },
      )
    } catch (error) {
      const statusErr = error as { status?: number }
      if (statusErr.status && statusErr.status === 404) {
        return
      }
      throw error
    }
    // TODO #59 error handling if file cant be parsed
    return ignore.default().add(todoIgnoreFileRaw.data)
  }

  private async getTarballUrl(ref?: string): Promise<string> {
    const { url, headers, method } = this.octokit.request.endpoint(
      'GET /repos/{owner}/{repo}/tarball/{ref}',
      {
        owner: this.owner,
        repo: this.repo,
        ref: ref || '',
      },
    )

    return new Promise((resolve, reject) => {
      const getReq = request(
        url,
        {
          method,
          headers: Object.assign(headers, {
            Authorization: `Bearer ${this.githubToken}`,
          }),
        },
        (res) => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 399) {
            if (res.headers['location']) {
              return resolve(res.headers['location'])
            } else {
              reject(
                new Error(
                  'Getting tarball URL request failed due to missing location header.',
                ),
              )
            }
          }
          reject(
            new Error(`Getting tarball URL request failed: ${res.statusCode}`),
          )
        },
      )
      getReq.end()
    })
  }

  private async getTarballStream(url: string): Promise<IncomingMessage> {
    return new Promise((resolve, reject) => {
      const downloadRequest = request(
        url,
        { method: 'GET', timeout: 5000 },
        (res) => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 299) {
            return resolve(res)
          }
          reject(
            new Error(`Getting tarball URL request failed: ${res.statusCode}`),
          )
        },
      )
      downloadRequest.end()
    })
  }

  private async extractTodosFromTarGz(
    tarBallStream: IncomingMessage,
    issueNr?: string,
    todoMetadata?: { [key: string]: string },
    ignore?: ignore.Ignore,
  ): Promise<TodoState> {
    // TODO #69 move logic
    const extractStream = tar.extract()
    const unzipStream = createGunzip()

    const todoState = new TodoState()

    tarBallStream.pipe(unzipStream).pipe(extractStream)
    // TODO #80 check and test event & error handling in streams (are they closed properly?) check for memory leaks
    // response.on('end', () => {
    //   // testStream.end();
    // });

    return new Promise((resolve, reject) => {
      // TODO #80 check and test event & error handling 
      unzipStream.on('error', (err) => {
        reject(`Error unzipping tarball stream: ${err.message}`)
      })

      // TODO #80 check and test event & error handling
      extractStream.on('error', (err: Error) => {
        reject(new Error(`Error reading tarball stream: ${err.message}`))
      })

      extractStream.on('finish', () => {
        console.log('Todos extraction completed successfully.')
        return resolve(todoState)
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
          core.info(`Skipping ${fileName} due to '.todoignore' rule...`)
          stream.resume()
          return next()
        }

        const splitLineStream = new SplitLineStream()
        // TODO #69 refactor: meta data should prob be added in post processing not in find stream
        const findTodosStream = new FindTodoStream(todoState, fileName, issueNr, todoMetadata)
        splitLineStream.on('end', () => findTodosStream.end())
        stream.pipe(splitLineStream).pipe(findTodosStream)
        stream.on('error', () => {
          core.warning(`Error extracting Todos from file: ${fileName}`)
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

  private async downloadTarball(ref?: string) {
    // TODO #59 try catch
    const url = await this.getTarballUrl(ref)
    return this.getTarballStream(url)
  }

  /**
   * Searches for all "TODOs" occurrences in a certain git ref
   * @param ref ref of the git state to be searched, defaults to the head of default branch if unset
   * @param issueNr if set, it will only seach occurences that reference this issueNr, such as "TODO #18 do this", otherwise it will search all "TODOs", whether they refernce any issue or none
   * @param todoMetadata optional key-value pairs that are appended to all found "TODOs" ocurrences
   * @returns TodoState
   */
  async getTodosFromGitRef(
    ref?: string,
    issueNr?: string,
    todoMetadata?: Record<string, string>,
  ) {
    // TODO #62 parallelize
    const tar = await this.downloadTarball(ref)
    const ignore = await this.getTodoIgnoreFile()
    const todoState = await this.extractTodosFromTarGz(
      tar,
      issueNr,
      todoMetadata,
      ignore,
    )
    return todoState
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

  async compareCommits(base: string, head: string) {
    return this.octokit.request(
      'GET /repos/{owner}/{repo}/compare/{basehead}',
      {
        owner: this.owner,
        repo: this.repo,
        basehead: `${base}...${head}`,
      },
    )
  }

  async findTodoHubIssue() {
    // TODO #79 author:me - could this fail if app is changed etc? label:todohub -> Should we allow removing the label?
    const todohubIssues = await this.octokit.rest.search.issuesAndPullRequests({
      per_page: 100,
      q: `todohub_ctrl_issue_data label:todohub is:issue in:body repo:${this.owner}/${this.repo} author:@me`,
    })
    if (todohubIssues.data.total_count > 1) {
      // TODO #79 check issues and return first one that matches criteria of (TodohubAdminIssue.parse)
      throw new Error('More than one Todohub Issue found')
    }
    if (todohubIssues.data.total_count === 1) {
      return todohubIssues.data.items[0]
    }
    // const issuePages = this.octokit.paginate.iterator(
    //   this.octokit.rest.search.issuesAndPullRequests, {
    //   owner: this.owner,
    //   repo: this.repo,
    //   per_page: 1,
    //   q: 'todohub_ctrl_issue label:todohub is:issue author:@me',
    //   headers: {
    //     Accept: 'application/vnd.github.text-match+json'
    //   }
    // })
  }

  async updateComment(commentId: number, body: string) {
    return this.octokit.request(
      'PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}',
      {
        owner: this.owner,
        repo: this.repo,
        comment_id: commentId,
        body,
      },
    )
  }

  async createComment(issueNumber: number, body: string) {
    return this.octokit.request(
      'POST /repos/{owner}/{repo}/issues/{issue_number}/comments',
      {
        owner: this.owner,
        repo: this.repo,
        issue_number: issueNumber,
        body,
      },
    )
  }

  async getIssue(issueNumber: number) {
    return this.octokit.rest.issues.get({
      owner: this.owner,
      repo: this.repo,
      issue_number: issueNumber,
    })
  }

  async createIssue(
    title: string,
    body: string,
    labels?: { name: string; description: string; color: string }[],
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
    labels?: { name: string; description: string; color: string }[],
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
