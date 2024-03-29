const fs = require('node:fs')
const path = require('node:path')
const { EOL } = require('os');
const gitPath = path.join('.', '.git', 'HEAD')
let gitHEAD
try {
  // TODO #72 search for git folder
  gitHEAD = fs.readFileSync(gitPath, 'utf8')
} catch (err) {
  console.debug('Not in git folder')
}
const currentIssue = Number.parseInt(gitHEAD.split('/').pop()?.split('-')[0])
const isFeatureBranch = !Number.isNaN(currentIssue)

const todoWithoutIssueRefRegex = /(?<keyword>TODO):?(?<whitespace>[^\S\r\n]+)(?<issue_ref>\(?#?[0-9]+\)?)?(?<todo_txt>.*)/gim
const todoWithCurrentIssueRegex = new RegExp(`(?<keyword>TODO):?[^\S\r\n]+(?<numberGroup>\\(?#?(?<issueNumber>${currentIssue})\\)?)(?<todoText>.*)`, 'i')

// TODO #72 add tests
// TODO #72 publish
// TODO #72 move to another repo
// TODO #72 prevent false positives better

module.exports = {
  'no-todos-without-issue-ref': {
    meta: {
      type: 'suggestion',
      hasSuggestions: true,
    },
    create: function (context) {
      return {
        Program() {
          context.sourceCode.getAllComments().forEach(comment => {
            const matches = comment.value.matchAll(todoWithoutIssueRefRegex)
            // Currently, in multiline comment blocks, we are looking for all matches and we are reporting one error for the whole block without hint where exactly error occurred
            // The suggestion replaces all occurrences in the block and overrides the whole block
            // TODO #72 give more precise hints of occurrences + and allow fixing indiviual occurrences in a comment block

            // Find Todos in Comments which match the Regex but do NOT have an issue reference
            let firstTodoWithoutIssueRefMatch
            for (const match of matches) {
              if (match.groups && !match.groups['issue_ref']) {
                firstTodoWithoutIssueRefMatch = match
                break
              }
            }

            if (!firstTodoWithoutIssueRefMatch) {
              return
            }

            let suggestion = undefined
            if (isFeatureBranch) {
              suggestion = [{
                desc: `Reference the current branch's issue number (#${currentIssue}) in the TODO.`,
                fix: function (fixer) {
                  let replaceSuggestion = comment.value.replaceAll(todoWithoutIssueRefRegex, (_match, keyword, whitespace, _issue_ref, todo_txt) =>
                    `${keyword}${whitespace}#${currentIssue} ${todo_txt}`)

                  if (comment.type === 'Line') {
                    replaceSuggestion = `//${replaceSuggestion}`
                  } else if (comment.type === 'Block') {
                    replaceSuggestion = `/*${replaceSuggestion}*/`
                  }

                  return fixer.replaceTextRange(comment.range, replaceSuggestion)
                }
              }]
            }
            let todoTxtShortened = firstTodoWithoutIssueRefMatch.groups['todo_txt'].substring(0, 32)
            if (todoTxtShortened.length < firstTodoWithoutIssueRefMatch.groups['todo_txt'].length) {
              todoTxtShortened += '...'
            }

            context.report({
              loc: comment.loc,
              message: `TODOs must reference an issue, such as: "${firstTodoWithoutIssueRefMatch.groups['keyword']} #${isFeatureBranch ? currentIssue : '15'} ${todoTxtShortened}"`,
              suggest: suggestion
            })
          })
        },
      }
    },
  },
  'current-feature-branch-issues': {
    meta: {
      type: 'suggestion',
    },
    create: function (context) {
      return {
        Program() {
          if (!isFeatureBranch) {
            return
          }
          context.sourceCode.getAllComments().forEach(comment => {
            let lineNr = 0
            for (const line of comment.value.split(EOL)) {
              const match = line.match(todoWithCurrentIssueRegex)
              if (match) {
                // TODO #72 get exact location of TODO match, not comment start / end line
                context.report({
                  loc: {
                    start: {
                      line: comment.loc.start.line + lineNr,
                      column: comment.type === 'Line' ? comment.loc.start.column + 2 : ((comment.type === 'Block' && lineNr === 0) ? 2 : 0)
                    },
                    end: {
                      line: comment.loc.start.line + lineNr,
                      column: comment.type === 'Line' ? comment.loc.end.column + 2 : line.length
                    }
                  },
                  message: match[0],
                })
              }
              lineNr++
            }
          })
        },
      }
    },
  },
}
