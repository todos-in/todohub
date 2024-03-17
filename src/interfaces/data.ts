import { z } from 'zod'

export interface IRepoTodoStates {
  /** Return all TodoStates of Todos that reference an issue by issueNr (Only excludes stray Todos)*/
  getIssuesTodoStates(): Record<number, TodoState>
  getTodoState(issueNr: number): TodoState | undefined
  getStrayTodoState(): TodoState | undefined
  getAllTodoStates(): Record<number, TodoState>
  getLastUpdatedCommit(): string | undefined
  getTrackedIssuesNumbers(): Set<number>
  setIssueTodoState(issueNr: number, todoState: TodoState): TodoState
  setStrayTodoState(todoState: TodoState): TodoState
  setLastUpdatedCommit(sha: string): void
  todoStateEquals(issueNr: number, todos: ITodo[]): boolean
}

export interface ITodo {
  fileName: string;
  lineNumber: number;
  rawLine: string;
  keyword: string;
  issueNumber?: number;
  todoText: string;
  foundInCommit?: string;
  doneInCommit?: string;
}

export interface TodoState {
  trackedBranch: string;
  commentId?: number;
  commitSha: string;
  todos: ITodo[];
  deadIssue?: boolean;
}

export interface Encodable {
  encode(): string
}

export interface IRepoTodoStatesDataFormat {
  todoStates: Record<number, TodoState>,
  lastUpdatedCommitSha?: string,
}

// io-ts type runtime - type checking formats
// TODO #59 can we replace the plain interfaces with the zod types?

const zTodo = z.object({
  fileName: z.string(),
  lineNumber: z.number().int(),
  rawLine: z.string(),
  keyword: z.string(),
  issueNumber: z.number().int().optional(),
  todoText: z.string(),
  foundInCommit: z.string().optional(),
  doneInCommit: z.string().optional(),

})

const zTodoState = z.object({
  trackedBranch: z.string(),
  commentId: z.number().int().optional(),
  commitSha: z.string(),
  todos: z.array(zTodo),
  deadIssue: z.boolean().optional(),
})

const zIntegerString = z.string().regex(/^[0-9]+$/)

export const zRepoTodoStatesDataFormat = z.object({
  todoStates: z.record(zIntegerString, zTodoState),
  lastUpdatedCommitSha: z.string().optional(),
})
