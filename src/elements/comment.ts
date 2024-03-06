import { ITodo } from 'src/types/todo.js'
import TodohubTag from './tag.js'

export default class TodohubComment {
  rawText?: string
  preTag?: string
  postTag?: string
  midTag?: string
  tag: TodohubTag
  issueId: string
  commentId?: string

  constructor(
    issueId: string,
    issueNumber?: number,
    existingComment?: { body: string; id: string },
  ) {
    this.issueId = issueId
    if (existingComment) {
      const parsed = this.parseContent(existingComment.body)
      if (!parsed) {
        throw new Error(
          'Trying to instantiate TodoComment which cant be parsed.',
        )
      }
      // TODO check if all parts were parsed
      this.rawText = existingComment.body
      this.commentId = existingComment.id
      this.preTag = parsed.preTag
      this.midTag = parsed.midTag
      this.postTag = parsed.postTag
      this.tag = new TodohubTag(parsed.tagData)
    } else {
      this.tag = new TodohubTag()
    }
  }

  getExistingCommentId() {
    return this.commentId
  }

  async write() {
    // TODO implement
  }

  mergeTodos(todos: ITodo[]) {
    this.tag.mergeTodos(todos)
  }

  resetTag() {
    this.midTag = ''
    this.tag = new TodohubTag()
  }

  setTodos(todos: ITodo[], commitSha: string) {
    this.tag.setTodos(todos, commitSha)
  }

  static isTodohubComment(commentBody?: string) {
    // TODO make sure this always works
    return !!commentBody?.includes('<!--')
  }

  private parseContent(commentBody: string) {
    const regex =
      /(?<preTag>[\s\S]*)<!--todohub_data="(?<tagData>.*)"-->(?<midTag>[\s\S]*)<!--todohub_end-->(?<postTag>[\s\S]*)/
    const parsed = commentBody.match(regex)
    if (parsed) {
      return {
        preTag: parsed.groups?.['preTag'],
        postTag: parsed.groups?.['postTag'],
        tagData: parsed.groups?.['tagData'],
        midTag: parsed.groups?.['midTag'],
      }
    }
    throw new Error('Could not parse todohub comment content')
  }

  compose() {
    this.midTag += `\n TODOs (in branch ${this.tag.trackedBranch})`
    for (const todo of this.tag.todos) {
      this.midTag += `\n* [ ] \`${todo.fileName}\`: ${todo.keyword} ${todo.todoText}`
    }
    this.midTag += '\n'
    return `${this.preTag || ''}<!--todohub_data="${this.tag.encode()}"-->${this.midTag || ''}<!--todohub_end-->${this.postTag || ''}`
  }
}
