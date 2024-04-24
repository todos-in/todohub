import { Octokit } from '@octokit/core'
import { throttling } from '@octokit/plugin-throttling'
import { restEndpointMethods } from '@octokit/plugin-rest-endpoint-methods'
import { paginateRest } from '@octokit/plugin-paginate-rest'
import { Logger } from 'interfaces/logger.js'
import { Config } from 'interfaces/config.js'

const MAX_RETRIES = 10
const USER_AGENT = 'todohub/v1'

export class GithubApiClient {

  private DefaultOctokitWithPlugins = Octokit.plugin(restEndpointMethods, throttling, paginateRest).defaults({
    throttle: {
      retryAfterBaseValue: 1200,
      fallbackSecondaryRateRetryAfter: 20,
      onRateLimit: (retryAfter, options, _octokit, retryCount) => {
        this.logger.warning(`Rate limit exhausted for request: ${options.method} ${options.url}.`)
        if (retryCount <= MAX_RETRIES) {
          this.logger.info(`Retrying after ${retryAfter} seconds. Retry number #${retryCount + 1}/${MAX_RETRIES}.`)
          return true
        }
      },
      onSecondaryRateLimit: (retryAfter, options, _octokit, retryCount) => {
        this.logger.warning(`Secondary rate limit exhausted for request: ${options.method} ${options.url}`)
        if (retryCount <= MAX_RETRIES) {
          this.logger.info(`Retrying after ${retryAfter} seconds. Retry number #${retryCount + 1}/${MAX_RETRIES}.`)
          return true
        }
      },
    },
    userAgent: USER_AGENT,
  })

  octokit
  
  constructor(private logger: Logger, private config: Config) {
    this.octokit = new this.DefaultOctokitWithPlugins({
      auth: `token ${this.config.getGithubToken()}`,
    })
  }
}
