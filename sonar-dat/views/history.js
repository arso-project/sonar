const { mapRecordsIntoLevelDB } = require('kappa-record-db/views/helpers')
const through = require('through2')

module.exports = function recordView (level, db) {
  return {
    version: 2,
    map (records, next) {
      mapRecordsIntoLevelDB({
        records,
        level,
        db,
        map (msg) {
          if (!msg.timestamp) return
          return [{ key: msg.timestamp + '/' + msg.lseq }]
        }
      }, next)
    },
    api: {
      query (_kappa, opts, _db) {
        if (!opts.from) opts.from = '0'
        if (!opts.to) opts.to = 'z'
        return level.createReadStream(opts).pipe(through.obj(function (row, _enc, next) {
          const lseq = row.key.split('/')[1]
          this.push({ lseq })
          next()
        }))
      }
    }
  }
}
