import { TTodo } from '../model/validation.js'

export function levenshteinDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length

  // Optimize: if one string is empty, distance is the length of the other
  if (m === 0) return n
  if (n === 0) return m

  // Use two rows instead of full matrix for O(min(m,n)) space
  let previousRow = new Array<number>(n + 1)
  let currentRow = new Array<number>(n + 1)

  for (let j = 0; j <= n; j++) {
    previousRow[j] = j
  }

  for (let i = 1; i <= m; i++) {
    currentRow[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      currentRow[j] = Math.min(
        (currentRow[j - 1] as number) + 1,       // insertion
        (previousRow[j] as number) + 1,           // deletion
        (previousRow[j - 1] as number) + cost,    // substitution
      )
    }
    const tmp = previousRow
    previousRow = currentRow
    currentRow = tmp
  }

  return previousRow[n] as number
}

/**
 * Returns a similarity ratio between 0 and 1 based on Levenshtein distance.
 * 1 means identical, 0 means completely different.
 */
export function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return 1 - levenshteinDistance(a, b) / maxLen
}

/**
 * Calculates a line number proximity score between 0 and 1.
 * Lines at the same position score 1, lines further apart score lower.
 * Lines more than maxDistance apart score 0.
 */
export function lineProximity(lineA: number, lineB: number, maxDistance = 30): number {
  const diff = Math.abs(lineA - lineB)
  if (diff === 0) return 1
  if (diff >= maxDistance) return 0
  return 1 - diff / maxDistance
}

// Weights for the multi-factor similarity score
const WEIGHTS = {
  fileName: 0.25,
  lineNumber: 0.25,
  todoText: 0.50,
} as const

/**
 * calculates a multi-factor similarity score between two Todos.
 * Returns a value between 0 and 1 (1 means identical)
 *
 * factors:
 * - File name match (25%): exact match or path similarity
 * - Line number proximity (25%): how close the line numbers are
 * - todotext similarity (50%): Levenshtein similarity of the todo-description-text
 */
export function todoSimilarity(oldTodo: TTodo, newTodo: TTodo): number {
  // precondition: issue numbers must match
  if ((oldTodo.issueNumber || 0) !== (newTodo.issueNumber || 0)) {
    return 0
  }

  let score = 0

  if (oldTodo.fileName === newTodo.fileName) {
    score += WEIGHTS.fileName
  } else {
    // Check if just the base filename matches (file was moved)
    const oldBase = oldTodo.fileName.split('/').pop() || ''
    const newBase = newTodo.fileName.split('/').pop() || ''
    if (oldBase === newBase && oldBase !== '') {
      score += WEIGHTS.fileName * 0.6
    } else {
      score += WEIGHTS.fileName * stringSimilarity(oldTodo.fileName, newTodo.fileName)
    }
  }

  score += WEIGHTS.lineNumber * lineProximity(oldTodo.lineNumber, newTodo.lineNumber)
  score += WEIGHTS.todoText * stringSimilarity(oldTodo.todoText.trim(), newTodo.todoText.trim())

  return score
}
