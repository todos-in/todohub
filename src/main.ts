import * as core from '@actions/core'
import * as github from '@actions/github'
import process from 'node:process'
import { Git } from './git'

const userAgent = 'todohub/v1'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const context = github.context
    const githubToken = core.getInput('token')

    const git = new Git(process.cwd())
    const githubSha = core.getInput('GITHUB_SHA')
    const githubRef = core.getInput('GITHUB_REF')
    const changes = await git.getFileChanges(`~${githubSha}~`, githubSha)

    const octokit = github.getOctokit(githubToken, { userAgent })
    const newIssue = await octokit.rest.issues.create({
      owner: context.repo.owner,
      repo: context.repo.repo,
      title: 'Test issue',
      body: 'Test issue body'
    })
    core.debug(newIssue.data.url)

    core.setOutput('new-issue', newIssue.data.url)
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
    else core.setFailed('Something bad happenes')
  }
}
