interface ITodo {
  fileName: string,
  // line: number,
  rawLine: string,
  keyword: string,
  issueNumber?: number,
  todoText: string,
}

export default class Todos {
  todos: ITodo[] = [];
  todosByIssueNo: Record<number, ITodo> = {}

  addTodos(todos: ITodo[]) {
    this.todos = this.todos.concat(todos);
    for (const todo of todos) {
      this.todosByIssueNo[todo.issueNumber || 0] = todo;
    }
  }

  getByIssueNo(issueNo: number) {
    return this.todosByIssueNo[issueNo];
  }
}
