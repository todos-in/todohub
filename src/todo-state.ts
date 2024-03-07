import { ITodo } from './types/todo.js'

export default class TodoState {
  // todos: ITodo[] = []
  todosByIssueNo: Record<number, ITodo[]> = {}

  addTodos(todos: ITodo[]) {
    // this.todos = this.todos.concat(todos)
    for (const todo of todos) {
      const issueNr = todo.issueNumber || 0
      if (!this.todosByIssueNo[issueNr]) {
        this.todosByIssueNo[issueNr] = []
      }
      this.todosByIssueNo[issueNr]?.push(todo)
    }
  }

  getIssuesNumbers() {
    const issueNrs = new Set(Object.keys(this.todosByIssueNo))
    issueNrs.delete('0')
    return issueNrs
  }

  getByIssueNo(issueNo: number) {
    return this.todosByIssueNo[issueNo]
  }

  getTodosWithoutIssueNo() {
    return this.getByIssueNo(0)
  }
}
