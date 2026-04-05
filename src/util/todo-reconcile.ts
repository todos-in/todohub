import { Todo } from '../model/model.todo.js'
import { TTodo } from '../model/validation.js'
import { todoSimilarity } from './todo-similarity.js'

const MATCH_THRESHOLD = 0.7

interface MatchResult {
  /** the reconciled list of items: matched (updated), new (foundInCommit set), and removed (doneInCommit set) */
  todos: Todo[]
  /** Whether the reconciled list differs from the previous state */
  changed: boolean
}

/**
 * Reconciles a previous list of tracked items with a newly scanned list.
 *
 * Three-phase matching:
 * 1. Exact matches: same file, line, and rawLine
 * 2. Similarity matches: multi-factor scoring above threshold
 * 3. Remaining: unmatched old items are marked done, unmatched new items are marked as found
 *
 * @param previousTodos - Items from the previous state (may include already-done items)
 * @param currentTodos - Items freshly scanned from the current commit
 * @param commitSha - The current commit SHA for setting foundInCommit/doneInCommit
 * @returns The reconciled list and whether it changed
 */
export function reconcileTodos(
  previousTodos: TTodo[],
  currentTodos: TTodo[],
  commitSha: string,
): MatchResult {
  const previouslyDone = previousTodos.filter(t => t.doneInCommit)
  const previousOpen = previousTodos.filter(t => !t.doneInCommit)

  const unmatchedOld = new Set<number>(previousOpen.map((_, i) => i))
  const unmatchedNew = new Set<number>(currentTodos.map((_, i) => i))

  const matched: Todo[] = []

  // Get exact matches (same issueNumber + file + line + rawLine)
  for (const oldIdx of [...unmatchedOld]) {
    const oldTodo = previousOpen[oldIdx] as TTodo
    for (const newIdx of [...unmatchedNew]) {
      const newTodo = currentTodos[newIdx] as TTodo
      if (
        (oldTodo.issueNumber || 0) === (newTodo.issueNumber || 0) &&
        oldTodo.fileName === newTodo.fileName &&
        oldTodo.lineNumber === newTodo.lineNumber &&
        oldTodo.rawLine === newTodo.rawLine
      ) {
        // Exact match: preserve foundInCommit from old, update other fields
        matched.push(new Todo({
          ...newTodo,
          foundInCommit: oldTodo.foundInCommit || commitSha,
        }))
        unmatchedOld.delete(oldIdx)
        unmatchedNew.delete(newIdx)
        break
      }
    }
  }

  // Similarity matching using greedy best-match
  if (unmatchedOld.size > 0 && unmatchedNew.size > 0) {
    // Build similarity matrix for remaining unmatched items
    const pairs: { oldIdx: number; newIdx: number; score: number }[] = []

    for (const oldIdx of unmatchedOld) {
      for (const newIdx of unmatchedNew) {
        const score = todoSimilarity(previousOpen[oldIdx] as TTodo, currentTodos[newIdx] as TTodo)
        if (score >= MATCH_THRESHOLD) {
          pairs.push({ oldIdx, newIdx, score })
        }
      }
    }

    pairs.sort((a, b) => b.score - a.score)

    for (const pair of pairs) {
      if (!unmatchedOld.has(pair.oldIdx) || !unmatchedNew.has(pair.newIdx)) {
        continue
      }

      const oldTodo = previousOpen[pair.oldIdx] as TTodo
      const newTodo = currentTodos[pair.newIdx] as TTodo

      // Similar match: treat as an update of the same item
      matched.push(new Todo({
        ...newTodo,
        foundInCommit: oldTodo.foundInCommit || commitSha,
      }))
      unmatchedOld.delete(pair.oldIdx)
      unmatchedNew.delete(pair.newIdx)
    }
  }

  // Mark remaining unmatched old items as done, add new items
  const nowDone: Todo[] = []
  for (const oldIdx of unmatchedOld) {
    const oldTodo = previousOpen[oldIdx] as TTodo
    nowDone.push(new Todo({
      ...oldTodo,
      doneInCommit: commitSha,
    }))
  }

  const newlyFound: Todo[] = []
  for (const newIdx of unmatchedNew) {
    const newTodo = currentTodos[newIdx] as TTodo
    newlyFound.push(new Todo({
      ...newTodo,
      foundInCommit: newTodo.foundInCommit || commitSha,
    }))
  }

  // Combine open items first (matched + new), then done items (previously done + newly done)
  const allDone = [...previouslyDone.map(t => new Todo(t)), ...nowDone]
  const allOpen = [...matched, ...newlyFound]
  const reconciled = [...allOpen, ...allDone]

  // Determine if anything changed
  const changed = hasChanged(previousTodos, reconciled)

  return { todos: reconciled, changed }
}

/**
 * Checks whether the reconciled list differs from the previous list.
 */
function hasChanged(previous: TTodo[], reconciled: Todo[]): boolean {
  if (previous.length !== reconciled.length) return true

  const sortFn = (a: TTodo, b: TTodo) =>
    a.fileName.localeCompare(b.fileName)
    || (a.lineNumber - b.lineNumber)
    || a.rawLine.localeCompare(b.rawLine)
    || (a.doneInCommit || '').localeCompare(b.doneInCommit || '')

  const sortedPrev = [...previous].sort(sortFn)
  const sortedRecon = [...reconciled].sort(sortFn)

  for (let i = 0; i < sortedPrev.length; i++) {
    const prev = sortedPrev[i] as TTodo
    const recon = sortedRecon[i] as TTodo
    if (
      prev.fileName !== recon.fileName ||
      prev.lineNumber !== recon.lineNumber ||
      prev.rawLine !== recon.rawLine ||
      prev.doneInCommit !== recon.doneInCommit ||
      prev.foundInCommit !== recon.foundInCommit
    ) {
      return true
    }
  }

  return false
}
