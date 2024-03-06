module.exports = {
  'no-todos-without-issue-ref': {
    meta: {
      type: 'suggestion',
    },
    create: function(context) {
      return {
        Program() {
          context.getSourceCode().getAllComments().forEach(comment => {
            const regex = /(?<keyword>TODO)[^\S\r\n]*(?<issue_ref>\(?#?[0-9]+\)?)?[^\S\r\n]+(?<todo_txt>.*)/gim
            for (const match of comment.value.matchAll(regex)) {
              if (match.groups && match.groups['issue_ref']) {
                continue
              }
              let txt = match.groups['todo_txt'].substring(0, 40)
              if (txt.length < match.groups['todo_txt'].length) {
                txt += '...'
              }
              context.report({
                // missing exact linenumber of occurence in multiline comments
                loc: comment.loc,
                message: `TODOs must reference an issue, such as: "${match.groups['keyword']} (#15) ${txt}"`
              })  
            }
          })
        }
      }
    }  
  }
}
