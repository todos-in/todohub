import {matchTodos} from '../src/todo-match'


describe('Regex unit tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('default match case', async () => {
    const matches = matchTodos(`// TODO (#1823) default match case`)
    expect(matches).toHaveLength(1);
    expect(matches[0]).toHaveProperty('todo_keyword', 'TODO');
    expect(matches[0]).toHaveProperty('issue_number', '1823');
    expect(matches[0]).toHaveProperty('todo_text', 'default match case');
  })

  it('keyword case variation 1', async () => {
    const matches = matchTodos(`// todo (#1823) keyword case variation 1`)
    expect(matches).toHaveLength(1);
    expect(matches[0]).toHaveProperty('todo_keyword', 'todo');
    expect(matches[0]).toHaveProperty('issue_number', '1823');
    expect(matches[0]).toHaveProperty('todo_text', 'keyword case variation 1');
  })

  it('keyword case variation 2', async () => {
    const matches = matchTodos(`// ToDo (#1823) keyword case variation 1`)
    expect(matches).toHaveLength(1);
    expect(matches[0]).toHaveProperty('todo_keyword', 'ToDo');
    expect(matches[0]).toHaveProperty('issue_number', '1823');
    expect(matches[0]).toHaveProperty('todo_text', 'keyword case variation 1');
  })

  it('whitespace variation 1', async () => {
    const matches = matchTodos(` // TODO(#1823) whitespace variation 1`)
    expect(matches).toHaveLength(1);
    expect(matches[0]).toHaveProperty('todo_keyword', 'TODO');
    expect(matches[0]).toHaveProperty('issue_number', '1823');
    expect(matches[0]).toHaveProperty('todo_text', 'whitespace variation 1');
  })

  it('whitespace variation 2', async () => {
    const matches = matchTodos(`// TODO(#1823)whitespace variation 2 `)
    expect(matches).toHaveLength(1);
    expect(matches[0]).toHaveProperty('todo_keyword', 'TODO');
    expect(matches[0]).toHaveProperty('issue_number', '1823');
    expect(matches[0]).toHaveProperty('todo_text', 'whitespace variation 2 ');
  })

  it('whitespace variation 3', async () => {
    const matches = matchTodos(`// TODO (#1823)whitespace variation 3`)
    expect(matches).toHaveLength(1);
    expect(matches[0]).toHaveProperty('todo_keyword', 'TODO');
    expect(matches[0]).toHaveProperty('issue_number', '1823');
    expect(matches[0]).toHaveProperty('todo_text', 'whitespace variation 3');
  })

  it('no hashtag', async () => {
    const matches = matchTodos(`// TODO (1823) no hashtag`)
    expect(matches).toHaveLength(1);
    expect(matches[0]).toHaveProperty('todo_keyword', 'TODO');
    expect(matches[0]).toHaveProperty('issue_number', '1823');
    expect(matches[0]).toHaveProperty('todo_text', 'no hashtag');
  })

  it('no paranthesis', async () => {
    const matches = matchTodos(`// TODO #1823 no paranthesis`)
    expect(matches).toHaveLength(1);
    expect(matches[0]).toHaveProperty('todo_keyword', 'TODO');
    expect(matches[0]).toHaveProperty('issue_number', '1823');
    expect(matches[0]).toHaveProperty('todo_text', 'no paranthesis');
  })

  it('no paranthesis and hashtag', async () => {
    const matches = matchTodos(`// TODO 1823 no paranthesis and hashtag`)
    expect(matches).toHaveLength(1);
    expect(matches[0]).toHaveProperty('todo_keyword', 'TODO');
    expect(matches[0]).toHaveProperty('issue_number', '1823');
    expect(matches[0]).toHaveProperty('todo_text', 'no paranthesis and hashtag');
  })

  it('empty todo text', async () => {
    const matches = matchTodos(`// TODO (#1823)`)
    expect(matches).toHaveLength(1);
    expect(matches[0]).toHaveProperty('todo_keyword', 'TODO');
    expect(matches[0]).toHaveProperty('issue_number', '1823');
    expect(matches[0]).toHaveProperty('todo_text', '');
  })

  it('closing parenthesis is missing', async () => {
    const matches = matchTodos(`// TODO (#1823 closing parenthesis is missing`)
    expect(matches).toHaveLength(1);
    expect(matches[0]).toHaveProperty('todo_keyword', 'TODO');
    expect(matches[0]).toHaveProperty('issue_number', '1823');
    expect(matches[0]).toHaveProperty('todo_text', 'closing parenthesis is missing');
  })
})
