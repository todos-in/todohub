import { RepoTodoStates } from '../service/data.js'

export type Id = number

export interface DataStore {
  get(id?: Id): Promise<RepoTodoStates>
  write(data: RepoTodoStates, id?: Id, ): Promise<Id>
}
