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
const todoRegex = /(?<todo_keyword>TODO)[^\S\r\n]*\(?#?(?<issue_number>[0-9]+)\)?[^\S\r\n]*(?<todo_text>.*)/gmi

export const matchTodos = (text: string) => {
  const matches = text.matchAll(todoRegex);
  const groups = [];
  for (const match of matches) {
    groups.push(match.groups);
  }
  return groups;
}
