const cp = require('child_process')
const fs = require('fs')
const p = require('path')

const argv = process.argv.slice(2)
if (!argv.length) onerror()

const example = argv[0]
const dir = p.join(__dirname, '../examples', example)
if (!fs.existsSync(dir)) onerror(`Example \`${example}\` not found`)
console.log(`Starting ${example}`)
cp.spawn('yarn', ['dev'], {
  stdio: 'inherit',
  shell: true,
  cwd: dir
})

function onerror (err) {
  if (err) console.log(String(err))
  else console.log('node example.js <EXAMPLE>')
  process.exit(1)
}
