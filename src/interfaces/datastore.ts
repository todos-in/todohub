import { IRepoTodoStates } from './data.js'

export type Id = number

export interface DataStore {
  get(id?: Id): Promise<IRepoTodoStates>
  write(data: IRepoTodoStates, id?: Id, ): Promise<Id>
}
