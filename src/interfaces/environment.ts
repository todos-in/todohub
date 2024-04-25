export interface Environment {
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
  runId: number
  runAttempt: number | undefined
}
