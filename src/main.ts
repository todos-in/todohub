import * as core from '@actions/core'
import { wait } from './wait'
import * as github from '@actions/github'
const userAgent = 'todohub/v1'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const ms = core.getInput('milliseconds')

    // Debug logs are only output if the `ACTIONS_STEP_DEBUG` secret is true
    core.debug(`Waiting ${ms} milliseconds ...`)

    const context = github.context
    const githubToken = core.getInput('GITHUB_TOKEN')
    
    const octokit = github.getOctokit(githubToken, { userAgent })
    const newIssue = await octokit.rest.issues.create({
      owner: context.repo.owner,
      repo: context.repo.repo,
      title: 'Test issue',
      body: 'Test issue body'
    })
    core.debug(newIssue.url)

    // Log the current timestamp, wait, then log the new timestamp
    core.debug(new Date().toTimeString())
    await wait(parseInt(ms, 10))
    core.debug(new Date().toTimeString())

    // Set outputs for other workflow steps to use
    core.setOutput('time', new Date().toTimeString())
    core.setOutput('new-issue', newIssue.url)
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
