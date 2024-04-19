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
    if (runInfo.cancelReason) {
      let reason = ''
      if (runInfo.cancelReason === 'BRANCH_DID_NOT_TRIGGER') {
        reason = 'Todohub is only triggered for the repositories default branch and for feature branches in the format `1-branch-name`'
      }

      core.summary.addDetails('Todohub not executed', reason)
      return
    }

    core.setOutput('UPDATED_ISSUES', runInfo.succesfullyUpdatedIssues.join(','))
    core.setOutput('SKIPPED_UNCHANGED_ISSUES', runInfo.skippedUnchangedIssues.join(','))
    core.setOutput('ISSUES_FAILED_TO_UPDATE', runInfo.failedToUpdate.join(','))
    core.setOutput('TODOHUB_CONTROL_ISSUE_ID', runInfo.todohubIssueId)

    core.summary
      .addEOL()
      .addRaw(`
>[!NOTE]
> Tracked Todohub Control Issue: #${runInfo.todohubIssueId}
> Total updated TODOs in this run: ${runInfo.totalTodosUpdated}
> Issues updated: ${runInfo.succesfullyUpdatedIssues.length}
> Skipped TODOs in this run: ${runInfo.skippedUnchangedIssues.length}
> TODOs without Issue Reference: ${runInfo.strayTodos}
`, true)

    if (runInfo.failedToUpdate.length) {
      core.summary.addRaw(`
>[!WARNING]
> Issues failed to update: ${runInfo.failedToUpdate.length}`, true)
    }

    core.summary.addSeparator()
      .addHeading('✅ Updated Issues', 4)
      .addList(runInfo.succesfullyUpdatedIssues.map(issueNr => `#${issueNr}`))
      .addEOL()
    
    if (runInfo.skippedUnchangedIssues.length) {
      core.summary
        .addHeading('🧘‍♀️ Skipped Issues without any changes', 4)
        .addEOL()
        .addList(runInfo.skippedUnchangedIssues.map(issueNr => `#${issueNr}`))
    }
    if (runInfo.failedToUpdate.length) {
      core.summary
        .addHeading('⚠️ Failed to update:', 4)
        .addList(runInfo.failedToUpdate.map(issueNr => `#${issueNr}`))
    }

    core.summary.write()
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
