/**
 * /(?<todo_keyword>TODO)   # Match 'TODO' and capture it in a named group
 * [^\S\r\n]*               # Match any non-newline whitespace characters zero or more times
 * \(?                      # Match an optional opening parenthesis
 * #?                       # Match an optional '#' character
 * (?<issue_number>[0-9]+)  # Match and capture one or more digits in a named group called 'issue_number'
 * \)?                      # Match an optional closing parenthesis
 * [^\S\r\n]*               # Match any non-newline whitespace characters (excluding carriage returns) zero or more times
 * (?<todo_text>.*)         # Match and capture any characters in a named group called 'todo_text'
 * /gmi                     # Find all matches in text, globally, match case insensitive
 *  
 * Matches example: "TODO (#1823) Fix this here"
 */
// const todoRegex = /(?<todo_keyword>TODO)[^\S\r\n]*\(?#?(?<issue_number>[0-9]+)\)?[^\S\r\n]*(?<todo_text>.*)/gmi
const todoRegexWithOrWithoutNumber = /(?<keyword>TODO)[^\S\r\n]*(?<numberGroup>\(?#?(?<issueNumber>[0-9]+)\)?)?[^\S\r\n]*(?<todoText>.*)/gmi

interface TodoRegexMatch {
  rawLine: string,
  keyword: string,
  issueNumber?: number,
  todoText: string,
}

export const matchTodos: (text: string) => TodoRegexMatch[] = (text) => {
  const matches = text.matchAll(todoRegexWithOrWithoutNumber);
  const todos: TodoRegexMatch[] = [];
  for (const match of matches) {
    if (!match.groups?.keyword) {
      console.warn('Regex issue: keyword not found in match - this should not happen.');
      continue;
    }

    let issueNumber = undefined;
    if (match.groups?.issueNumber) {
      issueNumber = parseInt(match.groups?.issueNumber);
      if (Number.isNaN(issueNumber)) {
        console.warn('Regex issue: issueNumber could not be parsed from match - this should not happen.');
        continue;
      }  
    }

    todos.push({
      rawLine: match[0],
      keyword: match.groups?.keyword,
      issueNumber,
      todoText: match.groups?.todoText,
    });
  }
  return todos;
}
