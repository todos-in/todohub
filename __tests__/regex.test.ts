import {matchTodos} from '../src/todo-match'


describe('Regex unit tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('default match case', async () => {
    const matches = matchTodos(`// TODO (#1823) default match case`)
    expect(matches).toHaveLength(1);
    expect(matches[0]).toHaveProperty('keyword', 'TODO');
    expect(matches[0]).toHaveProperty('issueNumber', 1823);
    expect(matches[0]).toHaveProperty('todoText', 'default match case');
  })

  it('match multiple TODOs', async () => {
    const matches = matchTodos(
      `// TODO (#1) fix me
      function sum(a, b) {
        return a-b;  // TODO (#2) here could be the problem
      }`
    )
    expect(matches).toHaveLength(2);
    expect(matches[0]).toHaveProperty('keyword', 'TODO');
    expect(matches[0]).toHaveProperty('issueNumber', 1);
    expect(matches[0]).toHaveProperty('todoText', 'fix me');
    expect(matches[1]).toHaveProperty('keyword', 'TODO');
    expect(matches[1]).toHaveProperty('issueNumber', 2);
    expect(matches[1]).toHaveProperty('todoText', 'here could be the problem');
  })

  it('keyword case variation 1', async () => {
    const matches = matchTodos(`// todo (#1823) keyword case variation 1`)
    expect(matches).toHaveLength(1);
    expect(matches[0]).toHaveProperty('keyword', 'todo');
    expect(matches[0]).toHaveProperty('issueNumber', 1823);
    expect(matches[0]).toHaveProperty('todoText', 'keyword case variation 1');
  })

  it('keyword case variation 2', async () => {
    const matches = matchTodos(`// ToDo (#1823) keyword case variation 1`)
    expect(matches).toHaveLength(1);
    expect(matches[0]).toHaveProperty('keyword', 'ToDo');
    expect(matches[0]).toHaveProperty('issueNumber', 1823);
    expect(matches[0]).toHaveProperty('todoText', 'keyword case variation 1');
  })

  it('whitespace variation 1', async () => {
    const matches = matchTodos(` // TODO(#1823) whitespace variation 1`)
    expect(matches).toHaveLength(1);
    expect(matches[0]).toHaveProperty('keyword', 'TODO');
    expect(matches[0]).toHaveProperty('issueNumber', 1823);
    expect(matches[0]).toHaveProperty('todoText', 'whitespace variation 1');
  })

  it('whitespace variation 2', async () => {
    const matches = matchTodos(`// TODO(#1823)whitespace variation 2 `)
    expect(matches).toHaveLength(1);
    expect(matches[0]).toHaveProperty('keyword', 'TODO');
    expect(matches[0]).toHaveProperty('issueNumber', 1823);
    expect(matches[0]).toHaveProperty('todoText', 'whitespace variation 2 ');
  })

  it('whitespace variation 3', async () => {
    const matches = matchTodos(`// TODO (#1823)whitespace variation 3`)
    expect(matches).toHaveLength(1);
    expect(matches[0]).toHaveProperty('keyword', 'TODO');
    expect(matches[0]).toHaveProperty('issueNumber', 1823);
    expect(matches[0]).toHaveProperty('todoText', 'whitespace variation 3');
  })

  it('no hashtag', async () => {
    const matches = matchTodos(`// TODO (1823) no hashtag`)
    expect(matches).toHaveLength(1);
    expect(matches[0]).toHaveProperty('keyword', 'TODO');
    expect(matches[0]).toHaveProperty('issueNumber', 1823);
    expect(matches[0]).toHaveProperty('todoText', 'no hashtag');
  })

  it('no paranthesis', async () => {
    const matches = matchTodos(`// TODO #1823 no paranthesis`)
    expect(matches).toHaveLength(1);
    expect(matches[0]).toHaveProperty('keyword', 'TODO');
    expect(matches[0]).toHaveProperty('issueNumber', 1823);
    expect(matches[0]).toHaveProperty('todoText', 'no paranthesis');
  })

  it('no paranthesis and hashtag', async () => {
    const matches = matchTodos(`// TODO 1823 no paranthesis and hashtag`)
    expect(matches).toHaveLength(1);
    expect(matches[0]).toHaveProperty('keyword', 'TODO');
    expect(matches[0]).toHaveProperty('issueNumber', 1823);
    expect(matches[0]).toHaveProperty('todoText', 'no paranthesis and hashtag');
  })

  it('empty todo text', async () => {
    const matches = matchTodos(`// TODO (#1823)`)
    expect(matches).toHaveLength(1);
    expect(matches[0]).toHaveProperty('keyword', 'TODO');
    expect(matches[0]).toHaveProperty('issueNumber', 1823);
    expect(matches[0]).toHaveProperty('todoText', '');
  })

  it('closing parenthesis is missing', async () => {
    const matches = matchTodos(`// TODO (#1823 closing parenthesis is missing`)
    expect(matches).toHaveLength(1);
    expect(matches[0]).toHaveProperty('keyword', 'TODO');
    expect(matches[0]).toHaveProperty('issueNumber', 1823);
    expect(matches[0]).toHaveProperty('todoText', 'closing parenthesis is missing');
  })

  it('negative: typo in TODO', async () => {
    const matches = matchTodos(`// TODU (#1823) typo in TODO`)
    expect(matches).toHaveLength(0);
  })

  it('negative: typo in TODO', async () => {
    const matches = matchTodos(`// TODU (#1823) typo in TODO`)
    expect(matches).toHaveLength(0);
  })

  it('negative: text in issuenumber', async () => {
    const matches = matchTodos(`// TODO (#text) text in issuenumber`)
    expect(matches).toHaveLength(0);
  })

  it('negative: line break should break matching', async () => {
    const matches = matchTodos(`// TODO
    (#1823) line break should break matching`)
    expect(matches).toHaveLength(0);
  })
})
