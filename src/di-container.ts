import { Container, Factory, injected, token } from 'brandi'
import { Logger } from './interfaces/logger.js'
import { ActionLogger } from './service/logger.js'
import { ActionOctokitGetter } from './service/octokit.js'
import { OctokitGetter } from './interfaces/octokit.js'
import { Runner } from './main.js'
import { ActionConfig, getActionPushContext } from './service/config.js'
import { Config, PushContextGetter } from './interfaces/config.js'
import { EnvironmentService } from './service/environment.js'
import GithubService from './service/github.js'
import { FindTodoStream } from './util/find-todo-stream.js'
import { Todo } from './service/data.js'
import { DataStore } from './interfaces/datastore.js'
import { TodohubControlIssueDataStore } from './service/datastore.js'
import { GithubCommentFactory } from './service/comment.js'

export type FindTodoStreamFactoryArgs = [todos: Todo[], filename: string, issueNr?: number]

export const TOKENS = {
  logger: token<Logger>('logger'),
  runner: token<Runner>('runner'),
  environmentService: token<EnvironmentService>('environmentService'),
  octokitGetter: token<OctokitGetter>('octokitGetter'),
  githubService: token<GithubService>('githubService'),
  config: token<Config>('config'),
  pushContextGetter: token<PushContextGetter>('pushContextGetter'),
  // implement own factory class, this is too limited
  findTodoStreamFactory: token<Factory<FindTodoStream, FindTodoStreamFactoryArgs>>('Factory<FindTodoStream>'),
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
container.bind(TOKENS.octokitGetter).toConstant(ActionOctokitGetter)
container.bind(TOKENS.dataStore).toInstance(TodohubControlIssueDataStore).inTransientScope()
container.bind(TOKENS.githubCommentFactory).toInstance(GithubCommentFactory).inSingletonScope()

container.bind(TOKENS.findTodoStreamFactory).toFactory(FindTodoStream,
  (instance, todos, filename, issueNr?) => instance.initDi(todos, filename, issueNr))

injected(Runner, TOKENS.logger, TOKENS.environmentService, TOKENS.githubService, TOKENS.dataStore, TOKENS.githubCommentFactory)
injected(GithubService, TOKENS.octokitGetter, TOKENS.environmentService, TOKENS.logger, TOKENS.findTodoStreamFactory)
injected(EnvironmentService, TOKENS.pushContextGetter, TOKENS.config)
injected(TodohubControlIssueDataStore, TOKENS.githubService, TOKENS.logger)
injected(GithubCommentFactory, TOKENS.githubService, TOKENS.logger)

injected(FindTodoStream, TOKENS.environmentService, TOKENS.logger)
