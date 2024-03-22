import { EnvironmentLoadError, EnvironmentParsingError } from '../error/error.js'
import { Environment } from 'interfaces/environment.js'
import { Config, PushContextGetter } from '../interfaces/config.js'

export class EnvironmentService {

  constructor(private getContext: PushContextGetter, private config: Config) { }

  getEnv(): Environment {
    const context = this.getContext()

    const githubToken = this.config.getGithubToken()
    if (!githubToken) {
      throw new EnvironmentLoadError({ key: 'TOKEN', place: 'input' })
    }

    const maxLineLength = Number.parseInt(this.config.getMaxLineLength())
    if (!maxLineLength || Number.isNaN(maxLineLength)) {
      throw new EnvironmentLoadError({ key: 'MAX_LINE_LENGTH', place: 'input' })
    }

    const defaultBranch = context.payload.repository.default_branch
    if (!defaultBranch) {
      throw new EnvironmentLoadError({ key: 'repository.default_branch', place: 'context.payload' })
    }

    const repo = context.repo.repo
    if (!repo) {
      throw new EnvironmentLoadError({ key: 'repo.repo', place: 'context' })
    }

    const repoOwner = context.repo.owner
    if (!repoOwner) {
      throw new EnvironmentLoadError({ key: 'repo.owner', place: 'context' })
    }

    const ref = context.ref
    if (!ref) {
      throw new EnvironmentLoadError({ key: 'ref', place: 'context' })
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
}
