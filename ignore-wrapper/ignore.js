// Note: necessary because ignore package can't be imported properly as esm at the moment: https://github.com/kaelzhang/node-ignore/issues/96

const ignore = require('ignore')

module.exports = {ignoreWrapper: ignore.default}
