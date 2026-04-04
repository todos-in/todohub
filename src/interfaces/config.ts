import { context } from '@actions/github'
import { PushEvent } from '@octokit/webhooks-types'

type Context = typeof context
export interface PushContext extends Context {
  payload: PushEvent
}

export type PushContextGetter = () => PushContext

export interface Config {
  getGithubToken: () => string
  getMaxLineLength: () => string
}
