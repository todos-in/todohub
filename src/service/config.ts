import * as github from '@actions/github'
import * as core from '@actions/core'
import { Config, PushContext, PushContextGetter } from '../interfaces/config.js'

export const getActionPushContext: PushContextGetter = () => {
  return github.context as PushContext
}

export class ActionConfig implements Config {
  getGithubToken() {
    return core.getInput('TOKEN')
  }
  getMaxLineLength() {
    return core.getInput('MAX_LINE_LENGTH')
  }
}
