import * as github from '@actions/github'
import * as core from '@actions/core'
import { PushEvent } from '@octokit/webhooks-types'
import { EnvironmentLoadError, EnvironmentParsingError } from '../error.js'

interface Environment {
  commitSha: string
  branchName: string
  ref: string
  githubToken: string
  repo: string
  repoOwner: string
  defaultBranch: string
  isDefaultBranch: boolean
  featureBranchNumber?: number
  isFeatureBranch: boolean
  maxLineLength: number
}

const parse: () => Environment = () => {
  const context = github.context
  const payload = github.context.payload as PushEvent

  const githubToken = core.getInput('TOKEN')
  if (!githubToken) {
    throw new EnvironmentLoadError({key: 'TOKEN', place: 'input'})
  }

  const maxLineLength = Number.parseInt(core.getInput('MAX_LINE_LENGTH'))
  if (!maxLineLength || Number.isNaN(maxLineLength)) {
    throw new EnvironmentLoadError({key: 'MAX_LINE_LENGTH', place: 'input'})
  }

  const defaultBranch = payload.repository.default_branch
  if (!defaultBranch) {
    throw new EnvironmentLoadError({key: 'repository.default_branch', place: 'context.payload'})
  }

  const repo = github.context.repo.repo
  if (!defaultBranch) {
    throw new EnvironmentLoadError({key: 'repo.repo', place: 'context'})
  }

  const repoOwner = github.context.repo.owner
  if (!defaultBranch) {
    throw new EnvironmentLoadError({key: 'repo.owner', place: 'context'})
  }

  const ref = github.context.ref
  if (!defaultBranch) {
    throw new EnvironmentLoadError({key: 'ref', place: 'context'})
  }

  const branchName = ref.split('/').pop()
  if (!branchName) {
    throw new EnvironmentParsingError(`Could not parse branchName from ref.context <${ref}>`)
  }

  const featureBranchNumber = branchName.match(/^(?<featureBranch>[0-9]+)-.*/)?.groups?.['featureBranch']

  let featureBranchNumberParsed: number | undefined
  if (featureBranchNumber) {
    featureBranchNumberParsed = Number.parseInt(featureBranchNumber)
    if (Number.isNaN(featureBranchNumber)) {
      throw new EnvironmentParsingError(`Could not parse Feature Branch Number - not an integer <${featureBranchNumber}>`)
    }
  }
  const commitSha = context.sha

  const isDefaultBranch = branchName === defaultBranch
  const isFeatureBranch = featureBranchNumber !== undefined

  core.debug(`Loaded env: <${commitSha}> <${ref}> <${repoOwner}> <${repo}> <${maxLineLength}>`)
  const environment = {
    commitSha,
    branchName,
    ref,
    githubToken,
    repo,
    repoOwner,
    defaultBranch,
    isDefaultBranch,
    featureBranchNumber: featureBranchNumberParsed,
    isFeatureBranch,
    maxLineLength,
  }
  return environment
}

const env = parse()

export default env