import * as github from '@actions/github'
import { GitHub } from '@actions/github/lib/utils.js'
import * as tar from 'tar-stream'
import { request } from 'node:https'
import { Writable } from 'node:stream'
import { createGunzip } from 'node:zlib'
import { IncomingMessage } from 'node:http'
import { matchTodos } from './util/todo-match.js'
import Todos from './todos.js'
import * as path from 'node:path'
import TodohubComment from './elements/comment.js'
import { ICommentsResponse, IIssuesResponse } from './types/github-api.js'

const DEFAULT_ISSUE_PER_PAGE = 100
const DEFAULT_COMMENTS_PER_PAGE = 30

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
        ref: ref || ''
      }
    )

    return new Promise((resolve, reject) => {
      const getReq = request(
        url,
        {
          method,
          headers: Object.assign(headers, {
            Authorization: `Bearer ${this.githubToken}`
          })
        },
        res => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 399) {
            if (res.headers['location']) {
              return resolve(res.headers['location'])
            } else {
              reject(
                new Error(
                  `Getting tarball URL request failed due to missing location header.`
                )
              )
            }
          }
          reject(
            new Error(`Getting tarball URL request failed: ${res.statusCode}`)
          )
        }
      )
      getReq.end()
    })
  }

  private async getTarballStream(url: string): Promise<IncomingMessage> {
    return new Promise((resolve, reject) => {
      const downloadRequest = request(
        url,
        { method: 'GET', timeout: 5000 },
        res => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 299) {
            return resolve(res)
          }
          reject(
            new Error(`Getting tarball URL request failed: ${res.statusCode}`)
          )
        }
      )
      downloadRequest.end()
    })
  }

  async getTodosFromGitRef(ref?: string, issueNr?: string) {
    const tar = await this.downloadTarball(ref)
    const todoState = await this.extractTodosFromTarGz(tar, issueNr);
    return todoState
  }

  async extractTodosFromTarGz(tarBallStream: IncomingMessage, issueNr?: string): Promise<Todos> {
    // TODO move logic
    const extractStream = tar.extract()
    const unzipStream = createGunzip()

    const todos = new Todos()

    const newFindTodoStream = (filePath: string) => {
      return new Writable({
        write: function (chunk, encoding, next) {
          const filePathParts = filePath.split(path.sep)
          filePathParts.shift()
          const fileName = { fileName: path.join(...filePathParts) }

          const todosFound = matchTodos(chunk.toString(), issueNr).map(todo =>
            Object.assign(todo, fileName)
          )
          todos.addTodos(todosFound)
          next()
        }
      })
    }

    tarBallStream.pipe(unzipStream).pipe(extractStream)
    // TODO check event handling
    // response.on('end', () => {
    //   // testStream.end();
    // });

    return new Promise((resolve, reject) => {
      unzipStream.on('error', err => {
        reject('Error unzipping tarball stream: ' + err.message)
      })

      extractStream.on('error', (err: Error) => {
        reject(new Error('Error reading tarball stream: ' + err.message))
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
            console.warn('Error extracting Todos from file: ' + header.name)
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

  async getIssue(issueNumber: number) {
    return this.octokit.rest.issues.get({
      owner: this.owner,
      repo: this.repo,
      issue_number: issueNumber
    })
  }

  getIssuesWithComments() {
    const issueQuery = `
    query($owner: String!, $repo: String!, $after: String = null) {
      repository(owner: $owner, name: $repo)
        {
          issues(first: ${DEFAULT_ISSUE_PER_PAGE}, after: $after) {
            nodes {
              title
              number
              id
              body
              author { login }
              comments(first: ${DEFAULT_COMMENTS_PER_PAGE}) {
                totalCount
                edges {
                  node {
                    author { login }
                    body 
                    id
                  }
                }
                pageInfo {
                  endCursor
                  hasNextPage
                }
              }
            }
          pageInfo {
            endCursor
            hasNextPage
          }
        }
      }
    }`

    const generator = (repo: Repo) => async function* () {
      let after = null;
      let hasNext = false;
      do {
        repo.API_HITS++
        const response = await repo.octokit.graphql(issueQuery, {
          after,
          owner: repo.owner,
          repo: repo.repo,
        }) as IIssuesResponse;

        yield response.repository.issues.nodes;

        after = response.repository.issues.pageInfo.endCursor;
        hasNext = response.repository.issues.pageInfo.hasNextPage;
      } while (hasNext);
    }

    return generator(this);
  }

  async findTodoHubComments() {
    const commentByIssue: Record<string, TodohubComment> = {}

    const getIssuesGenerator = this.getIssuesWithComments()
    for await (const issuePage of getIssuesGenerator()) {
      issuePageLoop: for (const issue of issuePage) {
        for (const comment of issue.comments.edges) {
          if (TodohubComment.isTodohubComment(comment.node.body)) {
            commentByIssue[issue.id] = new TodohubComment(issue.id, {id:comment.node.id, body: comment.node.body})
            continue issuePageLoop
          }
        }
        if (issue.comments.pageInfo.hasNextPage) {
          commentByIssue[issue.id] = await this.findTodoHubComment(issue.number, issue.comments.pageInfo.endCursor)
        }
        commentByIssue[issue.id] = new TodohubComment(issue.id)
      }
    }

    return commentByIssue;
  }

  async findTodoHubComment(issueNumber: number, after?: string | null) {
    const findCommentGenerator = this.getIssueCommentsGql(issueNumber, after);
    let issueId: string | undefined = undefined
    for await (const issueCommentsPage of findCommentGenerator()) {
      issueId = issueCommentsPage.id
      for (const comment of issueCommentsPage.comments.nodes) {
        if (TodohubComment.isTodohubComment(comment.body)) {
          return new TodohubComment(issueCommentsPage.id, {id: comment.id, body: comment.body})
        }
      }
    }
    if (!issueId) {
      // TODO should fail earlier (graphql should return not found) - handle this
      throw new Error('Not found')
    }
    return new TodohubComment(issueId)
  }

  getIssueCommentsGql(issueNumber: number, after: string | null = null) {
    const commentQuery = `query($owner: String!, $repo: String!, $issueNumber: Int!, $after: String = null) {
      repository(owner: $owner, name: $repo)
        {
          issue(number: $issueNumber) {
            id
            comments(first: ${DEFAULT_ISSUE_PER_PAGE}, after: $after) {
              nodes {
                body 
                id
                author { login }
              }
            pageInfo {
              endCursor
              hasNextPage
            }
          }
        }
      }
    }`

    const generator = (repo: Repo) => async function* () {
      let hasNext = false;
      do {
        repo.API_HITS++
        const response = await repo.octokit.graphql(commentQuery, {
          issueNumber,
          after,
          owner: repo.owner,
          repo: repo.repo
        }) as ICommentsResponse;

        yield response.repository.issue;

        after = response.repository.issue.comments.pageInfo.endCursor;
        hasNext = response.repository.issue.comments.pageInfo.hasNextPage;
      } while (hasNext);
    }

    return generator(this);
  }

  // async findTodoHubComment(issueNumber: number) {
  //   const commentsPages = this.octokit.paginate.iterator(
  //     this.octokit.rest.issues.listComments, {
  //     owner: this.owner,
  //     repo: this.repo,
  //     issue_number: issueNumber,
  //     per_page: 100,
  //   })
  //   for await (const commentsPage of commentsPages) {
  //     // TODO in app we can use 'performed_via_github_app' to find the comment?
  //     for (const comment of commentsPage.data) {
  //       // TODO search for exact tag
  //       if (TodohubComment.isTodohubComment(comment.body)) {
  //         return new TodohubComment(issueNumber, comment.body)
  //       }
  //     }
  //   }
  //   return new TodohubComment(issueNumber)
  // }

  // async getParsedIssue(issueNumber: number) {
  //   const issue = await this.octokit.rest.issues.get({
  //     owner: this.owner,
  //     repo: this.repo,
  //     issue_number: issueNumber
  //   })

  //   return new TodohubIssue(issue.data.body || '');
  // }

  async updateCommentGQl(commentId: string, body: string) {
    return this.octokit.graphql(`
      mutation($commentId: ID!, $body: String!) {
        updateIssueComment(input: {id: $commentId, body: $body}) {
          issueComment { id }
        }
      }`, {
      commentId,
      body,
      owner: this.owner,
      repo: this.repo
    })
  }

  async addCommentGQl(issueId: string, body: string) {
    return this.octokit.graphql(`
      mutation($issueId: ID!, $body: String!) {
        addComment(input: {subjectId: $issueId, body: $body}) {
          commentEdge { node { id } }
        }
      }`, {
      issueId,
      body,
      owner: this.owner,
      repo: this.repo
    })
  }

  async createComment(issueNumber: number, body: string) {
    return this.octokit.rest.issues.createComment({
      owner: this.owner,
      repo: this.repo,
      issue_number: issueNumber,
      body
    })
  }

  async createIssue(title: string, body: string) {
    return this.octokit.rest.issues.create({
      owner: this.owner,
      repo: this.repo,
      title,
      body
    })
  }
}
