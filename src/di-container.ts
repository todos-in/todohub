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
import { ITodo } from './interfaces/todo.js'

export type FindTodoStreamFactoryArgs = [todos: ITodo[], filename: string, issueNr?: number]

export const TOKENS = {
  logger: token<Logger>('logger'),
  runner: token<Runner>('runner'),
  environmentService: token<EnvironmentService>('environmentService'),
  octokitGetter: token<OctokitGetter>('octokitGetter'),
  githubService: token<GithubService>('githubService'),
  config: token<Config>('config'),
  pushContextGetter: token<PushContextGetter>('pushContextGetter'),
  findTodoStreamFactory: token<Factory<FindTodoStream, FindTodoStreamFactoryArgs>>('Factory<FindTodoStream>'),
}

export const container = new Container()

container.bind(TOKENS.runner).toInstance(Runner).inSingletonScope()
container.bind(TOKENS.environmentService).toInstance(EnvironmentService).inSingletonScope()
container.bind(TOKENS.githubService).toInstance(GithubService).inSingletonScope()

container.bind(TOKENS.logger).toInstance(ActionLogger).inSingletonScope()
container.bind(TOKENS.config).toInstance(ActionConfig).inSingletonScope()
container.bind(TOKENS.pushContextGetter).toConstant(getActionPushContext)
container.bind(TOKENS.octokitGetter).toConstant(ActionOctokitGetter)

container.bind(TOKENS.findTodoStreamFactory).toFactory(FindTodoStream,
  (instance, todos, filename, issueNr?) => instance.initDi(todos, filename, issueNr))

injected(Runner, TOKENS.logger, TOKENS.environmentService, TOKENS.githubService)
injected(GithubService, TOKENS.octokitGetter, TOKENS.environmentService, TOKENS.logger, TOKENS.findTodoStreamFactory)
injected(EnvironmentService, TOKENS.pushContextGetter, TOKENS.config)

injected(FindTodoStream, TOKENS.environmentService, TOKENS.logger)
