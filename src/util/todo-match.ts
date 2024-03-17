import { RegexError } from '../error/error.js'

// TODO #76 refine regex (make simpler?)
const regexCache: Record<string, RegExp> = {}
/**
 * If issueNumber is set: matches all Todos (with any issue refernce or none), e.g. (TOD‎O dothis, TOD‎O #18 dothis, TOD‎O 5 dothis, etc)
 * If issueNumber is unset: matches only Todos with specific issue reference,  e.g. with issueNumber = 18: (TOD‎O 18, TOD‎O #18 dothis, TOD‎O (18) dothis, etc)
 */
const getRegex = (issueNumber?: string) => {
  const index = issueNumber || '0'
  if (regexCache[index]) {
    return regexCache[index] as RegExp
  }
  const issueNrRegex = issueNumber ? `(?<numberGroup>\\(?#?(?<issueNumber>${issueNumber})\\)?):?` : '(?<numberGroup>\\(?#?(?<issueNumber>[0-9]+)\\)?)?:?'
  const regex = new RegExp(`(?<keyword>TODO)[^\\S\\r\\n]*${issueNrRegex}(([^\\S\\r\\n]+(?<todoText>.*))|$)`, 'i')
  regexCache[index] = regex
  return regex
}

interface TodoRegexMatch {
  rawLine: string;
  keyword: string;
  issueNumber?: number;
  todoText: string;
}

export const matchTodo = (textLine: string, onlyIssueNumber?: string): TodoRegexMatch | undefined => {
  const regex = getRegex(onlyIssueNumber)
  const match = textLine.match(regex)

  if (!match) {
    return
  }

  if (!(match.groups?.keyword)) {
    throw new RegexError('Could not parse "keyword" from match. This should not happen.')
  }

  const parsedIssueNumber = match.groups.issueNumber !== undefined ? Number.parseInt(match.groups.issueNumber) : NaN
  if (onlyIssueNumber && Number.isNaN(parsedIssueNumber)) {
    throw new RegexError('Could not parse "issueNumber" from match: not an integer.')
  }  
  
  return {
    rawLine: match[0],
    keyword: match.groups.keyword,
    issueNumber: Number.isNaN(parsedIssueNumber) ? undefined : parsedIssueNumber,
    todoText: match.groups.todoText || '',
  }
}
