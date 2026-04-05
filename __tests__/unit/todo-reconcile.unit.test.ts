import { jest, describe, beforeEach, it, expect } from '@jest/globals'
import { reconcileTodos } from '../../src/util/todo-reconcile.js'
import { TTodo } from '../../src/model/validation.js'

describe('todo-matcher: reconcileTodos', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const makeTodo = (overrides: Partial<TTodo> = {}): TTodo => ({
    fileName: 'src/app.ts',
    lineNumber: 10,
    rawLine: '// handle error case',
    keyword: 'keyword',
    todoText: 'handle error case',
    ...overrides,
  })

  describe('no previous state', () => {
    it('marks all current items as new with foundInCommit', () => {
      const current = [makeTodo(), makeTodo({ lineNumber: 20, rawLine: '// second item', todoText: 'second item' })]
      const { todos, changed } = reconcileTodos([], current, 'abc123')

      expect(changed).toBe(true)
      expect(todos).toHaveLength(2)
      expect(todos[0]?.foundInCommit).toBe('abc123')
      expect(todos[1]?.foundInCommit).toBe('abc123')
      expect(todos[0]?.doneInCommit).toBeUndefined()
      expect(todos[1]?.doneInCommit).toBeUndefined()
    })
  })

  describe('no changes', () => {
    it('returns changed=false when items are identical', () => {
      const items = [makeTodo({ foundInCommit: 'prev123' })]
      const current = [makeTodo()]
      const { todos, changed } = reconcileTodos(items, current, 'abc123')

      expect(changed).toBe(false)
      expect(todos).toHaveLength(1)
      expect(todos[0]?.foundInCommit).toBe('prev123')
      expect(todos[0]?.doneInCommit).toBeUndefined()
    })
  })

  describe('item removed', () => {
    it('marks removed item as done', () => {
      const previous = [
        makeTodo({ foundInCommit: 'prev123' }),
        makeTodo({ lineNumber: 20, rawLine: '// second item', todoText: 'second item', foundInCommit: 'prev123' }),
      ]
      // Only the second item remains
      const current = [makeTodo({ lineNumber: 20, rawLine: '// second item', todoText: 'second item' })]

      const { todos, changed } = reconcileTodos(previous, current, 'abc123')

      expect(changed).toBe(true)
      // Should have 2 items: 1 open + 1 done
      expect(todos).toHaveLength(2)

      const openTodos = todos.filter(t => !t.doneInCommit)
      const doneTodos = todos.filter(t => t.doneInCommit)

      expect(openTodos).toHaveLength(1)
      expect(openTodos[0]?.rawLine).toBe('// second item')
      expect(openTodos[0]?.foundInCommit).toBe('prev123')

      expect(doneTodos).toHaveLength(1)
      expect(doneTodos[0]?.rawLine).toBe('// handle error case')
      expect(doneTodos[0]?.doneInCommit).toBe('abc123')
    })
  })

  describe('item added', () => {
    it('adds new item with foundInCommit', () => {
      const previous = [makeTodo({ foundInCommit: 'prev123' })]
      const current = [
        makeTodo(),
        makeTodo({ lineNumber: 20, rawLine: '// new item', todoText: 'new item' }),
      ]

      const { todos, changed } = reconcileTodos(previous, current, 'abc123')

      expect(changed).toBe(true)
      expect(todos).toHaveLength(2)

      const openTodos = todos.filter(t => !t.doneInCommit)
      expect(openTodos).toHaveLength(2)

      // Existing item keeps its foundInCommit
      const existing = openTodos.find(t => t.rawLine === '// handle error case')
      expect(existing?.foundInCommit).toBe('prev123')

      // New item gets current commit
      const newItem = openTodos.find(t => t.rawLine === '// new item')
      expect(newItem?.foundInCommit).toBe('abc123')
    })
  })

  describe('item modified (similar match)', () => {
    it('matches a slightly modified item and preserves foundInCommit', () => {
      const previous = [makeTodo({
        rawLine: '// handle error case',
        todoText: 'handle error case',
        foundInCommit: 'prev123',
      })]
      const current = [makeTodo({
        rawLine: '// handle error cases properly',
        todoText: 'handle error cases properly',
      })]

      const { todos, changed } = reconcileTodos(previous, current, 'abc123')

      expect(changed).toBe(true)
      expect(todos).toHaveLength(1)
      // Should be treated as an update, not remove+add
      expect(todos[0]?.doneInCommit).toBeUndefined()
      expect(todos[0]?.foundInCommit).toBe('prev123')
      expect(todos[0]?.rawLine).toBe('// handle error cases properly')
    })

    it('matches item with shifted line number', () => {
      const previous = [makeTodo({
        lineNumber: 10,
        foundInCommit: 'prev123',
      })]
      const current = [makeTodo({
        lineNumber: 15,
      })]

      const { todos, changed: _changed } = reconcileTodos(previous, current, 'abc123')

      // Line shifted but same content - should match
      expect(todos).toHaveLength(1)
      expect(todos[0]?.doneInCommit).toBeUndefined()
      expect(todos[0]?.foundInCommit).toBe('prev123')
      expect(todos[0]?.lineNumber).toBe(15)
    })
  })

  describe('mixed add and remove in same commit', () => {
    it('correctly matches similar items and marks truly removed ones as done', () => {
      const previous = [
        makeTodo({ lineNumber: 10, rawLine: '// fix login bug', todoText: 'fix login bug', foundInCommit: 'prev1' }),
        makeTodo({ lineNumber: 20, rawLine: '// add tests for auth', todoText: 'add tests for auth', foundInCommit: 'prev2' }),
        makeTodo({ lineNumber: 30, rawLine: '// refactor database layer', todoText: 'refactor database layer', foundInCommit: 'prev3' }),
      ]
      const current = [
        // Slightly modified version of first item
        makeTodo({ lineNumber: 11, rawLine: '// fix login bug properly', todoText: 'fix login bug properly' }),
        // Third item is gone (truly removed)
        // Second item unchanged
        makeTodo({ lineNumber: 20, rawLine: '// add tests for auth', todoText: 'add tests for auth' }),
        // Brand new item
        makeTodo({ lineNumber: 40, rawLine: '// implement caching', todoText: 'implement caching' }),
      ]

      const { todos, changed } = reconcileTodos(previous, current, 'abc123')

      expect(changed).toBe(true)

      const openTodos = todos.filter(t => !t.doneInCommit)
      const doneTodos = todos.filter(t => t.doneInCommit)

      // 3 open (modified first + unchanged second + new fourth)
      expect(openTodos).toHaveLength(3)
      // 1 done (removed third)
      expect(doneTodos).toHaveLength(1)

      // Modified item preserves foundInCommit
      const modifiedItem = openTodos.find(t => t.rawLine.includes('fix login bug properly'))
      expect(modifiedItem?.foundInCommit).toBe('prev1')

      // Unchanged item preserves foundInCommit
      const unchangedItem = openTodos.find(t => t.rawLine.includes('add tests for auth'))
      expect(unchangedItem?.foundInCommit).toBe('prev2')

      // New item gets current commit
      const newItem = openTodos.find(t => t.rawLine.includes('implement caching'))
      expect(newItem?.foundInCommit).toBe('abc123')

      // Removed item is marked done
      expect(doneTodos[0]?.rawLine).toContain('refactor database layer')
      expect(doneTodos[0]?.doneInCommit).toBe('abc123')
    })
  })

  describe('previously done items are preserved', () => {
    it('keeps items that were already marked as done', () => {
      const previous = [
        makeTodo({ lineNumber: 10, foundInCommit: 'prev1' }),
        makeTodo({ lineNumber: 20, rawLine: '// old done item', todoText: 'old done item', foundInCommit: 'old1', doneInCommit: 'prev2' }),
      ]
      const current = [
        makeTodo({ lineNumber: 10 }),
      ]

      const { todos } = reconcileTodos(previous, current, 'abc123')

      const doneTodos = todos.filter(t => t.doneInCommit)
      expect(doneTodos).toHaveLength(1)
      expect(doneTodos[0]?.rawLine).toBe('// old done item')
      expect(doneTodos[0]?.doneInCommit).toBe('prev2') // Preserves original doneInCommit
    })
  })

  describe('all items removed', () => {
    it('marks all items as done when current is empty', () => {
      const previous = [
        makeTodo({ lineNumber: 10, foundInCommit: 'prev1' }),
        makeTodo({ lineNumber: 20, rawLine: '// second', todoText: 'second', foundInCommit: 'prev2' }),
      ]

      const { todos, changed } = reconcileTodos(previous, [], 'abc123')

      expect(changed).toBe(true)
      expect(todos).toHaveLength(2)
      expect(todos.every(t => t.doneInCommit === 'abc123')).toBe(true)
    })
  })

  describe('issue number is a strict matching precondition', () => {
    it('does not match items with different issue numbers even if text is identical', () => {
      const previous = [
        makeTodo({ issueNumber: 12, foundInCommit: 'prev1' }),
      ]
      const current = [
        makeTodo({ issueNumber: 13 }),
      ]

      const { todos } = reconcileTodos(previous, current, 'abc123')

      const openTodos = todos.filter(t => !t.doneInCommit)
      const doneTodos = todos.filter(t => t.doneInCommit)

      // Old item should be marked done, new item should be new
      expect(doneTodos).toHaveLength(1)
      expect(doneTodos[0]?.issueNumber).toBe(12)
      expect(doneTodos[0]?.doneInCommit).toBe('abc123')

      expect(openTodos).toHaveLength(1)
      expect(openTodos[0]?.issueNumber).toBe(13)
      expect(openTodos[0]?.foundInCommit).toBe('abc123')
    })

    it('does not match item with issue number to stray item without issue number', () => {
      const previous = [
        makeTodo({ issueNumber: 12, foundInCommit: 'prev1' }),
      ]
      const current = [
        makeTodo({ issueNumber: undefined }),
      ]

      const { todos } = reconcileTodos(previous, current, 'abc123')

      const openTodos = todos.filter(t => !t.doneInCommit)
      const doneTodos = todos.filter(t => t.doneInCommit)

      expect(doneTodos).toHaveLength(1)
      expect(doneTodos[0]?.issueNumber).toBe(12)

      expect(openTodos).toHaveLength(1)
      expect(openTodos[0]?.issueNumber).toBeUndefined()
    })

    it('matches items with same issue number', () => {
      const previous = [
        makeTodo({ issueNumber: 42, rawLine: '// fix the bug', todoText: 'fix the bug', foundInCommit: 'prev1' }),
      ]
      const current = [
        makeTodo({ issueNumber: 42, rawLine: '// fix the bugs', todoText: 'fix the bugs' }),
      ]

      const { todos } = reconcileTodos(previous, current, 'abc123')

      const openTodos = todos.filter(t => !t.doneInCommit)
      expect(openTodos).toHaveLength(1)
      expect(openTodos[0]?.foundInCommit).toBe('prev1')
      expect(openTodos[0]?.rawLine).toBe('// fix the bugs')
    })
  })

  describe('ambiguous matching prefers best score', () => {
    it('matches the most similar item when multiple candidates exist', () => {
      const previous = [
        makeTodo({ lineNumber: 10, rawLine: '// fix the login page bug', todoText: 'fix the login page bug', foundInCommit: 'prev1' }),
        makeTodo({ lineNumber: 20, rawLine: '// fix the signup page bug', todoText: 'fix the signup page bug', foundInCommit: 'prev2' }),
      ]
      const current = [
        // Modified version of the login one
        makeTodo({ lineNumber: 10, rawLine: '// fix the login page bugs', todoText: 'fix the login page bugs' }),
        // Modified version of the signup one
        makeTodo({ lineNumber: 20, rawLine: '// fix the signup page bugs', todoText: 'fix the signup page bugs' }),
      ]

      const { todos } = reconcileTodos(previous, current, 'abc123')

      const openTodos = todos.filter(t => !t.doneInCommit)
      expect(openTodos).toHaveLength(2)

      // Each should match its closest counterpart
      const loginItem = openTodos.find(t => t.rawLine.includes('login'))
      expect(loginItem?.foundInCommit).toBe('prev1')

      const signupItem = openTodos.find(t => t.rawLine.includes('signup'))
      expect(signupItem?.foundInCommit).toBe('prev2')
    })
  })
})
