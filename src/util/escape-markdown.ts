const replacers = [
  {regex: /\*/g, replace: '\\*'},
  // After applying common markdown stylings, github applies extra logic for issue/people mentions, which cant be easily escaped
  // as a workaround we add an invisible extra character behind # and @
  // https://stackoverflow.com/questions/20532546/escape-pound-or-number-sign-in-github-issue-tracker
  {regex: /#/g, replace: '\\#&#x2060;'}, 
  {regex: /@/g, replace: '\\@&#x2060;'},
  {regex: /\//g, replace: '\\/'},
  {regex: /\(/g, replace: '\\('},
  {regex: /\)/g, replace: '\\)'},
  {regex: /\[/g, replace: '\\['},
  {regex: /\]/g, replace: '\\]'},
  {regex: /</g, replace: '&lt;'},
  {regex: />/g, replace: '&gt;'},
  {regex: /_/g, replace: '\\_'},
  {regex: /`/g, replace: '\\`'},
]

export const escapeMd = (markdown: string) => {
  for (const replacer of replacers) {
    markdown = markdown.replace(replacer.regex, replacer.replace)
  }
  return markdown
}

