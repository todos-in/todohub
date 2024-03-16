import { Context } from '@actions/github/lib/context.js'
import { PushEvent } from '@octokit/webhooks-types'

export interface PushContext extends Context {
  payload: PushEvent
}

export type PushContextGetter = () => PushContext

export interface Config {
  getGithubToken: () => string
  getMaxLineLength: () => string
}
