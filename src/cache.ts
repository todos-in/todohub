interface Todo {
  file: string
  line: number
  rawLine: string
  keyword: string
  issueNumber?: number
  todoText: string
}

interface Cache {
  commitSha: string
  todos: Todo[]
}

let cache: Cache

// class TodoStore {
//   todos: Todo[] = [];

//   add(todo: Todo) {
//     if ()
//   }
// }

export const getCached = async (owner: string, repo: string) => {
  if (cache) {
    return cache
  }
  return null
}

export const setCache = async (
  owner: string,
  repo: string,
  commitSha: string,
  todos: Todo[]
) => {
  cache = {
    commitSha,
    todos
  }
}
