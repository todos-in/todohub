// TODO #76 refine regex (make simpler?) + add TODO: colon option

/**
 * If issueNumber is set: matches all Todos (with any issue refernce or none), e.g. (TODO‎ dothis, TODO #18 dothis, TODO 5 dothis, etc)
 * If issueNumber is unset: matches only Todos with specific issue reference,  e.g. with issueNumber = 18: (TODO 18, TODO #18 dothis, TODO (18) dothis, etc)
 */
const getRegex = (issueNumber?: string) => {
  // TODO #62 Creating regexp is expensive? Not a good idea to always recreate them instead of caching
  const issueNrRegex = issueNumber ? `(?<numberGroup>\\(?#?(?<issueNumber>${issueNumber})\\)?)` : '(?<numberGroup>\\(?#?(?<issueNumber>[0-9]+)\\)?)?'
  return new RegExp(`(?<keyword>TODO):?[^\\S\\r\\n]*${issueNrRegex}(([^\\S\\r\\n]+(?<todoText>.*))|$)`, 'i')
}

// (?<keyword>TODO)[^\S\r\n]*(?<numberGroup>\(?#?(?<issueNumber>[0-9]+)\)?)?(([^\S\r\n]+(?<todoText>.*))|$)
// (?<keyword>TODO)[^\S\r\n]*(?<numberGroup>\(?#?(?<issueNumber>[0-9]+)\)?)?[^\S\r\n]+(?<todoText>.*)

interface TodoRegexMatch {
  rawLine: string;
  keyword: string;
  issueNumber?: number;
  todoText: string;
}

export const matchTodo = (textLine: string, issueNumber?: string): TodoRegexMatch | undefined => {
  if (issueNumber && (Number.isNaN(Number.parseInt(issueNumber)))) {
    throw new Error('issueNumber is not an integer.')
  }

  const regex = getRegex(issueNumber)
  const match = textLine.match(regex)

  if (!match) {
    return
  }

  if (!(match.groups?.keyword)) {
    console.warn('Todo could not be parsed from code: keyword not found in match: ' + textLine)
    return
  }

  let parsedIssueNumber
  if (issueNumber) {
    if (!match.groups.issueNumber) {
      console.warn('Todo issueNumber could not be parsed from code: issueNr not found in match: ' + textLine)
      return  
    }
    parsedIssueNumber = Number.parseInt(match.groups?.issueNumber || '')
    if (Number.isNaN(parsedIssueNumber)) {
      console.warn('Parsing issue: issueNumber not an integer.')
      return
    }  
  }
  
  return {
    rawLine: match[0],
    keyword: match.groups.keyword,
    issueNumber: parsedIssueNumber,
    todoText: match.groups.todoText || '',
  }
}
