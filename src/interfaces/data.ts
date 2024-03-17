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

export interface IRepoTodoStatesDataFormat {
  todoStates: Record<number, TodoState>,
  lastUpdatedCommitSha?: string,
}
