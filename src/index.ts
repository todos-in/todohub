// /**
//  * The entrypoint for the action.
//  */

import { TOKENS, container } from './di-container.js'
import { TodohubError } from './error/error.js'
import * as core from '@actions/core'

// TODO #93 this runner should have the environment/context parser
// TODO #93 create Runnter for testing which returns, timings, setFailed and one for action, later for App

const runner = container.get(TOKENS.runner)
runner.run()
  .then((runInfo) => {
    // TODO #61 prettify summary and add useful information
    core.summary
      .addHeading('Updated Issues')
      .addList(runInfo.succesfullyUpdatedIssues.map(issueNr => `Issue Nr: ${issueNr}`))
      .addHeading('Skipped Issues')
      .addList(runInfo.skippedIssues.map(issueNr => `Issue Nr: ${issueNr}`))
      .write()
  })
  .catch((error) => {
    if (error instanceof TodohubError) {
      core.error('Error: ' + error.log())
      core.debug('Error debug info: ' + error.debugLog())
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
