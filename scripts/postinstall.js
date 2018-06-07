const { dirname, join } = require('path')
const fs = require('fs')

var prismDir = dirname(require.resolve('prismjs'))
var target = join(__dirname, '../static/prismjs')

if(!fs.existsSync(target))
  fs.symlinkSync(prismDir, target)
