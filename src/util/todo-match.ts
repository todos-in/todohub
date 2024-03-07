const getRegex = (issueNumber?: string) => {
  // If issueNumber is set: matches all Todos (with any issue refernce or none), e.g. (TODO dothis, TODO #18 dothis, TODO 5 dothis, etc)
  // If issueNumber is unset: matches only Todos with specific issue reference,  e.g. with issueNumber = 18: (TODO 18, TODO #18 dothis, TODO (18) dothis, etc)
  const issueNrRegex = issueNumber ? `(?<numberGroup>\\(?#?(?<issueNumber>${issueNumber})\\)?)` : '(?<numberGroup>\\(?#?(?<issueNumber>[0-9]+)\\)?)?'
  return new RegExp(`(?<keyword>TODO)[^\\S\\r\\n]*${issueNrRegex}[^\\S\\r\\n]+(?<todoText>.*)`, 'gim')
}

interface TodoRegexMatch {
  rawLine: string;
  keyword: string;
  issueNumber?: number;
  todoText: string;
}

export const matchTodos = (text: string, issueNumber?: string) => {
  if (issueNumber && (Number.isNaN(Number.parseInt(issueNumber)))) {
    throw new Error('issueNumber is not an integer.')
  }

  const regex = getRegex(issueNumber)
  const matches = text.matchAll(regex)
  const todos: TodoRegexMatch[] = []
  for (const match of matches) {
    if (!match.groups || !match.groups?.keyword) {
      console.warn('Todo could not be parsed from code: keyword not found in match: ' + text)
      continue
    }

    let issueNumber
    if (match.groups.issueNumber) {
      issueNumber = parseInt(match.groups.issueNumber)
      if (Number.isNaN(issueNumber)) {
        console.warn('Regex issue: issueNumber could not be parsed from match - this should not happen.')
        continue
      }
    }

    todos.push({
      rawLine: match[0],
      keyword: match.groups.keyword,
      issueNumber,
      todoText: match.groups.todoText || '',
    })
  }
  return todos
}
