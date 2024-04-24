import { Container, injected, token } from 'brandi'
import { Logger } from './interfaces/logger.js'
import { ActionLogger } from './service/logger.js'
import { GithubApiClient } from './service/github-api-client.js'
import { Runner } from './runner.js'
import { ActionConfig, getActionPushContext } from './service/config.js'
import { Config, PushContextGetter } from './interfaces/config.js'
import { EnvironmentService } from './service/environment.js'
import GithubService from './service/github.js'
import { FindTodoStreamFactory } from './util/find-todo-stream.js'
import { DataStore } from './interfaces/datastore.js'
import { TodohubControlIssueDataStore } from './service/datastore.js'
import { GithubCommentFactory } from './service/comment.js'

export const TOKENS = {
  logger: token<Logger>('logger'),
  runner: token<Runner>('runner'),
  environmentService: token<EnvironmentService>('environmentService'),
  githubApiClient: token<GithubApiClient>('githubClient'),
  githubService: token<GithubService>('githubService'),
  config: token<Config>('config'),
  pushContextGetter: token<PushContextGetter>('pushContextGetter'),
  findTodoStreamFactory: token<FindTodoStreamFactory>('findTodoStreamFactory'),
  dataStore: token<DataStore>('dataStore'),
  githubCommentFactory: token<GithubCommentFactory>('githubCommentFactory'),
}

export const container = new Container()

container.bind(TOKENS.runner).toInstance(Runner).inSingletonScope()
container.bind(TOKENS.environmentService).toInstance(EnvironmentService).inSingletonScope()
container.bind(TOKENS.githubService).toInstance(GithubService).inSingletonScope()

container.bind(TOKENS.logger).toInstance(ActionLogger).inSingletonScope()
container.bind(TOKENS.config).toInstance(ActionConfig).inSingletonScope()
container.bind(TOKENS.pushContextGetter).toConstant(getActionPushContext)
container.bind(TOKENS.githubApiClient).toInstance(GithubApiClient).inSingletonScope()
container.bind(TOKENS.dataStore).toInstance(TodohubControlIssueDataStore).inTransientScope()
container.bind(TOKENS.githubCommentFactory).toInstance(GithubCommentFactory).inSingletonScope()

container.bind(TOKENS.findTodoStreamFactory).toInstance(FindTodoStreamFactory).inSingletonScope()

injected(Runner, TOKENS.logger, TOKENS.environmentService, TOKENS.githubService, TOKENS.dataStore, TOKENS.githubCommentFactory)
injected(GithubService, TOKENS.githubApiClient, TOKENS.environmentService, TOKENS.logger, TOKENS.findTodoStreamFactory)
injected(EnvironmentService, TOKENS.pushContextGetter, TOKENS.config)
injected(TodohubControlIssueDataStore, TOKENS.githubService, TOKENS.logger)
injected(GithubCommentFactory, TOKENS.githubService, TOKENS.logger)
injected(GithubApiClient, TOKENS.logger, TOKENS.config)

injected(FindTodoStreamFactory, TOKENS.environmentService, TOKENS.logger)
