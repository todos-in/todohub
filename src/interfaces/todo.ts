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

export interface TrackedIssue {
  trackedBranch: string;
  commentId?: number;
  commitSha: string;
  todoState: ITodo[];
  deadIssue?: boolean;
}