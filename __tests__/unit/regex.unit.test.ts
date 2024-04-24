import { jest } from '@jest/globals'
import { matchTodo } from '../../src/util/todo-match.js'

describe('Regex unit tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Match all Todos', () => {
    it('default match case', async () => {
      const match = matchTodo('// TODO (#1823) default match case')
      expect(match).toBeTruthy()
      expect(match).toHaveProperty('keyword', 'TODO')
      expect(match).toHaveProperty('issueNumber', 1823)
      expect(match).toHaveProperty('todoText', 'default match case')
    })

    it('keyword case variation: lowercase', async () => {
      const match = matchTodo('// todo (#1823) keyword case variation: lowercase')
      expect(match).toBeTruthy()
      expect(match).toHaveProperty('keyword', 'todo')
      expect(match).toHaveProperty('issueNumber', 1823)
      expect(match).toHaveProperty('todoText', 'keyword case variation: lowercase')
    })

    it('keyword case variation: camelcase', async () => {
      const match = matchTodo('// ToDo (#1823) keyword case variation: camelcase')
      expect(match).toBeTruthy()
      expect(match).toHaveProperty('keyword', 'ToDo')
      expect(match).toHaveProperty('issueNumber', 1823)
      expect(match).toHaveProperty('todoText', 'keyword case variation: camelcase')
    })

    it('keyword with colon', async () => {
      const match = matchTodo('// ToDo: (#1823) keyword with colon')
      expect(match).toBeTruthy()
      expect(match).toHaveProperty('keyword', 'ToDo')
      expect(match).toHaveProperty('issueNumber', undefined)
      expect(match).toHaveProperty('todoText', '(#1823) keyword with colon')
    })

    it('keyword with colon after issue reference', async () => {
      const match = matchTodo('// ToDo #1823: keyword with colon after issue reference')
      expect(match).toBeTruthy()
      expect(match).toHaveProperty('keyword', 'ToDo')
      expect(match).toHaveProperty('issueNumber', 1823)
      expect(match).toHaveProperty('todoText', 'keyword with colon after issue reference')
    })

    it('no whitespace between keyword and number', async () => {
      const match = matchTodo(' // TODO(#1823) no whitespace between keyword and number')
      expect(match).toBeTruthy()
      expect(match).toHaveProperty('keyword', 'TODO')
      expect(match).toHaveProperty('issueNumber', 1823)
      expect(match).toHaveProperty('todoText', 'no whitespace between keyword and number')
    })

    it('no whitespace between number at text', async () => {
      // TODO #76 should this be able to match the line number?
      const match = matchTodo(' // TODO (#1823)no whitespace between number at text')
      expect(match).toBeTruthy()
      expect(match).toHaveProperty('keyword', 'TODO')
      expect(match).toHaveProperty('issueNumber', undefined)
      expect(match).toHaveProperty('todoText', '(#1823)no whitespace between number at text')
    })

    it('no whitespaces', async () => {
      // TODO #76 should this be able to match?
      const match = matchTodo(' // TODO(#1823)no whitespaces')
      expect(match).toBeFalsy()
    })

    it('default match case without number', async () => {
      const match = matchTodo('// TODO default match case without number')
      expect(match).toBeTruthy()
      expect(match).toHaveProperty('keyword', 'TODO')
      expect(match).toHaveProperty('issueNumber', undefined)
      expect(match).toHaveProperty('todoText', 'default match case without number')
    })

    it('issue number variation: no hashtag', async () => {
      const match = matchTodo('// TODO (1823) no hashtag')
      expect(match).toBeTruthy()
      expect(match).toHaveProperty('keyword', 'TODO')
      expect(match).toHaveProperty('issueNumber', 1823)
      expect(match).toHaveProperty('todoText', 'no hashtag')
    })

    it('issue number variation: no parenthesis', async () => {
      const match = matchTodo('// TODO #1823 no parenthesis')
      expect(match).toBeTruthy()
      expect(match).toHaveProperty('keyword', 'TODO')
      expect(match).toHaveProperty('issueNumber', 1823)
      expect(match).toHaveProperty('todoText', 'no parenthesis')
    })

    it('issue number variation: no parenthesis and hashtag', async () => {
      const match = matchTodo('// TODO 1823 no parenthesis and hashtag')
      expect(match).toBeTruthy()
      expect(match).toHaveProperty('keyword', 'TODO')
      expect(match).toHaveProperty('issueNumber', 1823)
      expect(match).toHaveProperty('todoText', 'no parenthesis and hashtag')
    })

    it('empty todo text', async () => {
      const match = matchTodo('// TODO (#1823)')
      expect(match).toBeTruthy()
      expect(match).toHaveProperty('keyword', 'TODO')
      expect(match).toHaveProperty('issueNumber', 1823)
      expect(match).toHaveProperty('todoText', '')
    })

    it('single TODO', async () => {
      const match = matchTodo('// TODO')
      expect(match).toBeTruthy()
      expect(match).toHaveProperty('keyword', 'TODO')
      expect(match).toHaveProperty('issueNumber', undefined)
      expect(match).toHaveProperty('todoText', '')
    })

    it('single TODO with trailing/leading whitespace', async () => {
      const match = matchTodo(' // TODO ')
      expect(match).toBeTruthy()
      expect(match).toHaveProperty('keyword', 'TODO')
      expect(match).toHaveProperty('issueNumber', undefined)
      expect(match).toHaveProperty('todoText', '')
    })

    it('negative: todo in other context', async () => {
      const match = matchTodo('function addTodosTo() {}')
      expect(match).toBeFalsy()
    })

    it('text in issuenumber', async () => {
      const match = matchTodo('// TODO (#text) text in issuenumber')
      expect(match).toBeTruthy()
      expect(match).toHaveProperty('todoText', '(#text) text in issuenumber')
      expect(match).toHaveProperty('issueNumber', undefined)
    })

    it('negative: typo in TODO', async () => {
      const match = matchTodo('// TODU (#1823) typo in "TODO"')
      expect(match).toBeFalsy()
    })
  })

  describe('Match only TODO with specific issue number', () => {
    it('default match case with number', async () => {
      const match = matchTodo('// TODO (#1823) default match case with number', '1823')
      expect(match).toBeTruthy()
      expect(match).toHaveProperty('keyword', 'TODO')
      expect(match).toHaveProperty('issueNumber', 1823)
      expect(match).toHaveProperty('todoText', 'default match case with number')
    })

    it('negative: shouldnt match due to wrong issue number', async () => {
      const match = matchTodo('// TODO (#1824) shouldnt match due to wrong issue number', '1823')
      expect(match).toBeFalsy()
    })

    it('negative: shouldnt match due to no issue number', async () => {
      const match = matchTodo('// TODO shouldnt match due to no issue number', '1823')
      expect(match).toBeFalsy()
    })

    it('negative: default match case without number', async () => {
      const match = matchTodo('// TODO default match case without number', '1823')
      expect(match).toBeFalsy()
    })

    it('issue number variation: no hashtag', async () => {
      const match = matchTodo('// TODO (1823) no hashtag', '1823')
      expect(match).toBeTruthy()
      expect(match).toHaveProperty('keyword', 'TODO')
      expect(match).toHaveProperty('issueNumber', 1823)
      expect(match).toHaveProperty('todoText', 'no hashtag')
    })

    it('issue number variation: no parenthesis', async () => {
      const match = matchTodo('// TODO #1823 no parenthesis', '1823')
      expect(match).toBeTruthy()
      expect(match).toHaveProperty('keyword', 'TODO')
      expect(match).toHaveProperty('issueNumber', 1823)
      expect(match).toHaveProperty('todoText', 'no parenthesis')
    })

    it('issue number variation: no parenthesis and hashtag', async () => {
      const match = matchTodo('// TODO 1823 no parenthesis and hashtag', '1823')
      expect(match).toBeTruthy()
      expect(match).toHaveProperty('keyword', 'TODO')
      expect(match).toHaveProperty('issueNumber', 1823)
      expect(match).toHaveProperty('todoText', 'no parenthesis and hashtag')
    })

    it('keyword with colon after issue reference', async () => {
      const match = matchTodo('// ToDo #1823: keyword with colon after issue reference', '1823')
      expect(match).toBeTruthy()
      expect(match).toHaveProperty('keyword', 'ToDo')
      expect(match).toHaveProperty('issueNumber', 1823)
      expect(match).toHaveProperty('todoText', 'keyword with colon after issue reference')
    })

    it('negative: keyword with colon', async () => {
      const match = matchTodo('// ToDo: (#1823) keyword with colon', '1823')
      expect(match).toBeFalsy()
    })
  })

})
