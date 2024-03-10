import * as github from '@actions/github'
import * as core from '@actions/core'
import { PushEvent } from '@octokit/webhooks-types'
import { EnvironmentLoadError } from './error.js'

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
}

export const get: () => Environment = () => {
  const context = github.context
  const payload = github.context.payload as PushEvent

  const githubToken = core.getInput('token')
  if (!githubToken) {
    throw new EnvironmentLoadError('Failed to load <token> from <input>')
  }

  const defaultBranch = payload.repository.default_branch
  if (!defaultBranch) {
    throw new EnvironmentLoadError('Failed to load <repository.default_branch> from <context.payload>')
  }

  const repo = github.context.repo.repo
  if (!defaultBranch) {
    throw new EnvironmentLoadError('Failed to load <repo.repo> from <context>')
  }

  const repoOwner = github.context.repo.owner
  if (!defaultBranch) {
    throw new EnvironmentLoadError('Failed to load <repo.owner> from <context>')
  }

  const ref = github.context.ref
  if (!defaultBranch) {
    throw new EnvironmentLoadError('Failed to load <ref> from <context>')
  }

  const branchName = ref.split('/').pop()
  if (!branchName) {
    throw new EnvironmentLoadError('Could not parse branchName from <ref.context>')
  }

  const featureBranchNumber = branchName.match(/^(?<featureBranch>[0-9]+)-.*/)?.groups?.['featureBranch']

  let featureBranchNumberParsed: number | undefined
  if (featureBranchNumber) {
    featureBranchNumberParsed = Number.parseInt(featureBranchNumber)
    if (Number.isNaN(featureBranchNumber)) {
      throw new EnvironmentLoadError('Parsed Feature Branch Number appears to not be an integer.')
    }
  }
  const commitSha = context.sha

  const isDefaultBranch = branchName === defaultBranch
  const isFeatureBranch = featureBranchNumber !== undefined

  return {
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
  }
}


