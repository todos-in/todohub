import { ITodo } from './types/todo.js'

export default class TodoState {
  // todos: ITodo[] = []
  todosByIssueNo: Record<number, ITodo[]> = {}

  addTodos(todos: ITodo[]) {
    // this.todos = this.todos.concat(todos)
    for (const todo of todos) {
      if (!this.todosByIssueNo[todo.issueNumber || 0]) {
        this.todosByIssueNo[todo.issueNumber || 0] = []
      }
      this.todosByIssueNo[todo.issueNumber || 0]?.push(todo)
    }
  }

  getIssuesNumbers() {
    return new Set(Object.keys(this.todosByIssueNo))
  }

  getByIssueNo(issueNo: number) {
    return this.todosByIssueNo[issueNo]
  }
}
