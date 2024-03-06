import * as github from '@actions/github'
import { GitHub } from '@actions/github/lib/utils.js'
import * as tar from 'tar-stream'
import { request } from 'node:https'
import { Writable } from 'node:stream'
import { createGunzip } from 'node:zlib'
import { IncomingMessage } from 'node:http'
import { matchTodos } from './util/todo-match.js'
import TodoState from './todo-state.js'
import * as path from 'node:path'

// TODO use graphql where possible to reduce data transfer
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

  async getTodosFromGitRef(
    ref?: string,
    issueNr?: string,
    todoMetadata?: Record<string, string>,
  ) {
    const tar = await this.downloadTarball(ref)
    const todoState = await this.extractTodosFromTarGz(
      tar,
      issueNr,
      todoMetadata,
    )
    return todoState
  }

  async extractTodosFromTarGz(
    tarBallStream: IncomingMessage,
    issueNr?: string,
    todoMetadata?: Record<string, string>,
  ): Promise<TodoState> {
    // TODO move logic
    const extractStream = tar.extract()
    const unzipStream = createGunzip()

    const todos = new TodoState()

    const newFindTodoStream = (
      filePath: string,
    ) => {
      return new Writable({
        write(chunk, encoding, next) {
          const filePathParts = filePath.split(path.sep)
          filePathParts.shift()
          const fileName = { fileName: path.join(...filePathParts) }

          // TODO seach line by line + skip lines > n characters
          const todosFound = matchTodos(chunk.toString(), issueNr).map((todo) =>
            Object.assign(todoMetadata || {}, todo, fileName),
          )
          todos.addTodos(todosFound)
          next()
        },
      })
    }

    tarBallStream.pipe(unzipStream).pipe(extractStream)
    // TODO check event handling
    // response.on('end', () => {
    //   // testStream.end();
    // });

    return new Promise((resolve, reject) => {
      unzipStream.on('error', (err) => {
        reject(`Error unzipping tarball stream: ${err.message}`)
      })

      extractStream.on('error', (err: Error) => {
        reject(new Error(`Error reading tarball stream: ${err.message}`))
      })

      extractStream.on('finish', () => {
        console.log('Todos extraction completed successfully.')
        return resolve(todos)
      })

      extractStream.on('entry', (header, stream, next) => {
        if (header.type === 'file') {
          const findTodosStream = newFindTodoStream(header.name)
          stream.pipe(findTodosStream)
          stream.on('error', () => {
            console.warn(`Error extracting Todos from file: ${header.name}`)
            findTodosStream.end()
            next()
          })
          stream.on('end', () => {
            findTodosStream.end()
            next()
          })
        } else {
          stream.resume()
          next()
        }
      })
    })
  }

  async downloadTarball(ref?: string) {
    // TODO try catch
    const url = await this.getTarballUrl(ref)
    return this.getTarballStream(url)
  }

  // TODO support closed issues.. ()
  async getIssue(issueNumber: number) {
    return this.octokit.rest.issues.get({
      owner: this.owner,
      repo: this.repo,
      issue_number: issueNumber,
    })
  }

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

  async findTodoHubIssue() {
    const todohubIssues = await this.octokit.rest.search.issuesAndPullRequests({
      // owner: this.owner,
      // repo: this.repo,
      per_page: 100,
      q: 'todohub_ctrl_issue_data is:issue in:body repo:nigeisel/todohub author:@me',
    })
    if (todohubIssues.data.total_count > 1) {
      // TODO check issues and return first one that matches criteria of (TodohubAdminIssue.parse)
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
    // // return issuePages
    // for await (const issuePage of issuePages) {
    //   // TODO in app we can use 'performed_via_github_app' to find the comment?
    //   for (const issue of issuePage.data) {
    //     // TODO search for exact tag
    //     return issue
    //   }
    // }
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
    // endpoint.headers = Object.assign(endpoint.headers, { Authorization: `Bearer ${this.githubToken}` })

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
}
