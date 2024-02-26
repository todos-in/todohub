import * as github from '@actions/github'
import { GitHub } from '@actions/github/lib/utils.js';
import * as tar from 'tar-stream';
import { request } from 'node:https';
import { Writable } from 'node:stream';
import { createGunzip } from 'node:zlib';
import { IncomingMessage } from 'node:http';
import { matchTodos } from './todo-match.js';
import Todos from './todos.js';
import * as path from 'node:path';

export default class Repo {
  githubToken: string;
  octokit: InstanceType<typeof GitHub>
  owner: string;
  repo: string;

  constructor(githubToken: string, owner: string, repo: string) {
    this.githubToken = githubToken;
    this.octokit = github.getOctokit(githubToken, { userAgent: 'todohub/v1' });
    this.owner = owner;
    this.repo = repo;
  }

  private async getTarballUrl(ref?: string): Promise<string> {
    const { url, headers, method } = this.octokit.request.endpoint('GET /repos/{owner}/{repo}/tarball/{ref}', {
      owner: this.owner,
      repo: this.repo,
      ref: ref || '',
    });

    return new Promise((resolve, reject) => {
      const getReq = request(url, { method, headers: Object.assign(headers, { Authorization: `Bearer ${this.githubToken}` }) }, (res) => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 399) {
          if (res.headers['location']) {
            return resolve(res.headers['location']);
          } else {
            reject(new Error(`Getting tarball URL request failed due to missing location header.`));
          }
        }
        reject(new Error(`Getting tarball URL request failed: ${res.statusCode}`));
      });
      getReq.end();
    });
  }

  private async getTarballStream(url: string): Promise<IncomingMessage> {
    return new Promise((resolve, reject) => {
      const downloadRequest = request(url, { method: 'GET', timeout: 5000 }, (res) => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 299) {
          return resolve(res);
        }
        reject(new Error(`Getting tarball URL request failed: ${res.statusCode}`));
      });
      downloadRequest.end();
    });
  }

  async downloadTarball(ref?: string) {
    const extractStream = tar.extract();
    const unzipStream = createGunzip();

    // TODO try catch
    const url = await this.getTarballUrl(ref);
    const response = await this.getTarballStream(url);

    response
      .pipe(unzipStream)
      .pipe(extractStream);

    const todos = new Todos();

    const newFindTodoStream = (filePath: string) => {
      return new Writable({
        write: function (chunk, encoding, next) {
          const filePathParts = filePath.split(path.sep);
          filePathParts.shift();
          const fileName = {fileName: path.join(...filePathParts)};

          const todosFound = matchTodos(chunk.toString())
            .map((todo) => Object.assign(todo, fileName));
          todos.addTodos(todosFound);
          next();
        }
      });    
    }

    // response.on('end', () => {
    //   // testStream.end();
    // });

    return new Promise((resolve, reject) => {
      unzipStream.on('error', (err) => {
        reject('Error unzipping tarball stream: ' + err.message);
      });
  
      extractStream.on('error', (err: Error) => {
        reject(new Error('Error reading tarball stream: ' + err.message));
      });

      extractStream.on('finish', () => {
        console.log('Todos extraction completed successfully.');
        return resolve(todos);
      });

      extractStream.on('entry', (header, stream, next) => {
        if (header.type === 'file') {
          const findTodosStream = newFindTodoStream(header.name);
          stream.pipe(findTodosStream);
          stream.on('error', () => {
            console.warn('Error extracting Todos from file: ' + header.name);
            findTodosStream.end();
            next();
          })
          stream.on('end', () => {
            findTodosStream.end();
            next();
          })
        } else {
          stream.resume();
          next();
        }
      });
    });
  }

  async getIssue(issueNumber: number) {
    return this.octokit.rest.issues.get({
      owner: this.owner,
      repo: this.repo,
      issue_number: issueNumber,
    })
  }

  async createIssue(title: string, body: string) {
    return this.octokit.rest.issues.create({
      owner: this.owner,
      repo: this.repo,
      title,
      body,
    })
  }
}
