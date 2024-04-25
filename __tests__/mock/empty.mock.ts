import { Container } from 'brandi'
import { TOKENS } from '../../src/di-container.js'
import { debugLogger } from './logger.mock.js'
import { PushContext } from '../../src/interfaces/config.js'
import { GithubApiClient } from '../../src/service/github-api-client.js'

export const setupEmptyMocks = (container: Container) => {
  container.bind(TOKENS.githubApiClient).toConstant({} as unknown as GithubApiClient)
  container.bind(TOKENS.config).toConstant({
    getGithubToken: () => 'token',
    getMaxLineLength: () => '1',
  })
  container.bind(TOKENS.pushContextGetter).toConstant(() => ({
    repo: { owner: 'owner', repo: 'repo' },
    sha: 'abc',
    ref: 'main',
    payload: {
      repository: {
        default_branch: 'main',
      },
    },
    runId: 12345678,
  } as PushContext),
  )
  container.bind(TOKENS.logger).toConstant(debugLogger)
}