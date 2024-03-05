import { ITodo } from './types/todo.js'

export default class Todo {
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

  getByIssueNo(issueNo: number) {
    return this.todosByIssueNo[issueNo]
  }
}
