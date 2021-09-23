const { Transform } = require('streamx')
const split = require('split2')
const EOL = '\n'
module.exports = {
  encode: (opts = {}) => {
    const encode = opts.encode || JSON.stringify
    return new Transform({
      transform (row, cb) {
        if (opts.map) row = opts.map(row)
        const data = encode(row) + EOL
        console.log('ENCODE', data)
        this.push(data)
        cb()
      }
    })
  },
  decode: (opts = {}) => {
    opts.strict = opts.strict !== false
    const decode = opts.decode || JSON.parse
    return split(parse, opts)
    function parse (row) {
      try {
        console.log('DECODE', row)
        let data = decode(row)
        if (opts.map) data = opts.map(data)
        this.push(data)
      } catch (err) {
        this.emit('error', new Error('Could not parse row ' + row.slice(0, 50) + '...'))
      }
    }
  }
}
