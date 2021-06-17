process.stderr.write('hi to stderr!')
process.stdout.write('hi to stdout!')

const repl = require('repl')

const sonar = { hello: 'world' }

const r = repl.start('> ')
r.context.sonar = sonar

// process.stdin.on('data', data => {
//   console.log(data.toString().toUpperCase())
// })
