import { jest, describe, beforeEach, it, expect } from '@jest/globals'
import {
  levenshteinDistance,
  stringSimilarity,
  lineProximity,
  todoSimilarity,
} from '../../src/util/todo-similarity.js'
import { TTodo } from '../../src/model/validation.js'

describe('todo-similarity', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('levenshteinDistance', () => {
    it('returns 0 for identical strings', () => {
      expect(levenshteinDistance('hello', 'hello')).toBe(0)
    })

    it('returns length of other string when one is empty', () => {
      expect(levenshteinDistance('', 'hello')).toBe(5)
      expect(levenshteinDistance('hello', '')).toBe(5)
    })

    it('returns 0 for two empty strings', () => {
      expect(levenshteinDistance('', '')).toBe(0)
    })

    it('calculates single character difference', () => {
      expect(levenshteinDistance('cat', 'bat')).toBe(1)
    })

    it('calculates insertion distance', () => {
      expect(levenshteinDistance('cat', 'cats')).toBe(1)
    })

    it('calculates deletion distance', () => {
      expect(levenshteinDistance('cats', 'cat')).toBe(1)
    })

    it('calculates complex distance', () => {
      expect(levenshteinDistance('kitten', 'sitting')).toBe(3)
    })

    it('handles completely different strings', () => {
      expect(levenshteinDistance('abc', 'xyz')).toBe(3)
    })
  })

  describe('stringSimilarity', () => {
    it('returns 1 for identical strings', () => {
      expect(stringSimilarity('hello', 'hello')).toBe(1)
    })

    it('returns 1 for two empty strings', () => {
      expect(stringSimilarity('', '')).toBe(1)
    })

    it('returns 0 for completely different strings of same length', () => {
      expect(stringSimilarity('abc', 'xyz')).toBe(0)
    })

    it('returns value between 0 and 1 for similar strings', () => {
      const sim = stringSimilarity('fix the bug', 'fix the bugs')
      expect(sim).toBeGreaterThan(0.9)
      expect(sim).toBeLessThan(1)
    })

    it('returns low similarity for very different strings', () => {
      const sim = stringSimilarity('hello world', 'completely different')
      expect(sim).toBeLessThan(0.3)
    })
  })

  describe('lineProximity', () => {
    it('returns 1 for same line number', () => {
      expect(lineProximity(10, 10)).toBe(1)
    })

    it('returns 0 for lines at max distance', () => {
      expect(lineProximity(1, 21, 20)).toBe(0)
    })

    it('returns 0 for lines beyond max distance', () => {
      expect(lineProximity(1, 100)).toBe(0)
    })

    it('returns value between 0 and 1 for nearby lines', () => {
      const prox = lineProximity(10, 15, 20)
      expect(prox).toBeGreaterThan(0)
      expect(prox).toBeLessThan(1)
      expect(prox).toBe(0.75)
    })

    it('respects custom max distance', () => {
      expect(lineProximity(1, 6, 10)).toBe(0.5)
      expect(lineProximity(1, 11, 10)).toBe(0)
    })
  })

  describe('todoSimilarity', () => {
    const baseTodo: TTodo = {
      fileName: 'src/app.ts',
      lineNumber: 10,
      rawLine: '// handle error case here',
      keyword: 'keyword',
      todoText: 'handle error case here',
    }

    it('returns 1 for identical items', () => {
      expect(todoSimilarity(baseTodo, { ...baseTodo })).toBe(1)
    })

    it('returns high score for minor text change', () => {
      const modified: TTodo = {
        ...baseTodo,
        rawLine: '// handle error cases here',
        todoText: 'handle error cases here',
      }
      const score = todoSimilarity(baseTodo, modified)
      expect(score).toBeGreaterThan(0.7)
    })

    it('returns high score for small line number shift', () => {
      const shifted: TTodo = {
        ...baseTodo,
        lineNumber: 12,
      }
      const score = todoSimilarity(baseTodo, shifted)
      expect(score).toBeGreaterThan(0.7)
    })

    it('returns moderate score for file rename with same content', () => {
      const renamed: TTodo = {
        ...baseTodo,
        fileName: 'src/renamed-app.ts',
      }
      const score = todoSimilarity(baseTodo, renamed)
      // Different file but same content - should still be somewhat similar
      expect(score).toBeGreaterThan(0.7)
    })

    it('returns high score for file move with same basename', () => {
      const moved: TTodo = {
        ...baseTodo,
        fileName: 'lib/app.ts',
      }
      const score = todoSimilarity(baseTodo, moved)
      expect(score).toBeGreaterThan(0.7)
    })

    it('returns low score for completely different items', () => {
      const different: TTodo = {
        fileName: 'other/file.py',
        lineNumber: 100,
        rawLine: '# completely unrelated comment',
        keyword: 'keyword',
        todoText: 'completely unrelated comment',
      }
      const score = todoSimilarity(baseTodo, different)
      expect(score).toBeLessThan(0.7)
    })

    it('handles items with same file but very different text', () => {
      const differentText: TTodo = {
        ...baseTodo,
        rawLine: '// refactor the entire module',
        todoText: 'refactor the entire module',
        lineNumber: 50,
      }
      const score = todoSimilarity(baseTodo, differentText)
      expect(score).toBeLessThan(0.7)
    })

    it('returns 0 when issue numbers differ', () => {
      const withIssue12: TTodo = { ...baseTodo, issueNumber: 12 }
      const withIssue13: TTodo = { ...baseTodo, issueNumber: 13 }
      expect(todoSimilarity(withIssue12, withIssue13)).toBe(0)
    })

    it('returns 0 when one has issue number and other does not', () => {
      const withIssue: TTodo = { ...baseTodo, issueNumber: 12 }
      const withoutIssue: TTodo = { ...baseTodo }
      expect(todoSimilarity(withIssue, withoutIssue)).toBe(0)
    })

    it('returns high score when issue numbers match', () => {
      const a: TTodo = { ...baseTodo, issueNumber: 42 }
      const b: TTodo = { ...baseTodo, issueNumber: 42 }
      expect(todoSimilarity(a, b)).toBe(1)
    })

    it('matches items with same undefined issue number', () => {
      // Both stray items (no issue number) should still be comparable
      const a: TTodo = { ...baseTodo }
      const b: TTodo = { ...baseTodo }
      expect(todoSimilarity(a, b)).toBe(1)
    })
  })
})
