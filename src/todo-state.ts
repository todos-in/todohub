import { ITodo } from './types/todo.js'

// merge with TodohubData
export default class TodoState {
  private STRAY_TODO_KEY = 0
  private todosByIssueNo: Record<number, ITodo[]> = {}

  addTodos(todos: ITodo[]) {
    for (const todo of todos) {
      const issueNr = todo.issueNumber || this.STRAY_TODO_KEY
      if (!this.todosByIssueNo[issueNr]) {
        this.todosByIssueNo[issueNr] = []
      }
      this.todosByIssueNo[issueNr]?.push(todo)
    }
  }

  getIssuesNumbers() {
    const issueNrs = new Set(Object.keys(this.todosByIssueNo).map((key) => Number.parseInt(key)))
    issueNrs.delete(this.STRAY_TODO_KEY)
    return issueNrs
  }

  getByIssueNo(issueNo: number) {
    return this.todosByIssueNo[issueNo]
  }

  getTodosWithoutIssueNo() {
    return this.getByIssueNo(0)
  }
}
