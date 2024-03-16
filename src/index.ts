// /**
//  * The entrypoint for the action.
//  */

import { RequestError } from '@octokit/request-error'
import { TOKENS, container } from './di-container.js'
import { TodohubError } from './error/error.js'
import * as core from '@actions/core'

// TODO #93 this runner should have the environment/context parser
// TODO #93 create Runnter for testing which returns, timings, setFailed and one for action, later for App

const runner = container.get(TOKENS.runner)
runner.run()
  .then((runInfo) => {
    // TODO #61 prettify summary and add useful information, add links, etc
    core.summary
      .addQuote(`Total updated TODOs in this run: ${runInfo.totalTodosUpdated},
        Total Issues updated: ${runInfo.succesfullyUpdatedIssues.length},
        Total failed to update: ${runInfo.failedToUpdate.length}`)
      .addHeading('✅ Updated Issues', 4)
      .addList(runInfo.succesfullyUpdatedIssues.map(issueNr => `Issue Nr: ${issueNr}`))
      .addHeading('🧘‍♀️ Skipped Issues without any changes', 4)
      .addList(runInfo.skippedUnchangedIssues.map(issueNr => `Issue Nr: ${issueNr}`))
      .addHeading('⚠️ Failed to update:', 4)
      .addList(runInfo.failedToUpdate.map(issueNr => `Issue Nr: ${issueNr}`))
      .write()
  })
  .catch((error) => {
    if (error instanceof TodohubError) {
      core.error('Error: ' + error.log())
      core.debug('Error debug info: ' + error.debugLog())
      core.setFailed(error.message)
    } else if (error instanceof RequestError) {
      core.error(`${error.message} - ${error.status}`)
      core.error(`Github request failed: ${error.request.method} ${error.request.url}`)
      core.debug('Error debug info: ' + error.stack)
      core.setFailed(error.message)
    } else if (error instanceof Error) {
      core.error(error.message)
      core.debug('Error debug info: ' + error.stack)
      core.setFailed(error.message)
    } else {
      core.setFailed('Failed.')
      core.error('Non-error object was thrown: ' + JSON.stringify(error))
    }
  })
