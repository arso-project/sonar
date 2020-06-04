const umkv = require('unordered-materialized-kv')
const { keyseq, once } = require('../lib/util')

module.exports = function kvView (lvl) {
  const kv = umkv(lvl, {
    // onupdate, onremove
  })

  return {
    name: 'kv',
    map (msgs, next) {
      const ops = msgs.map(record => ({
        key: kvkey(record),
        id: keyseq(record),
        links: record.links
      }))
      kv.batch(ops, next)
    },
    api: {
      getLinks (kappa, record, cb) {
        kv.get(kvkey(record), cb)
      },
      isLinked (kappa, record, cb) {
        kv.isLinked(keyseq(record), cb)
      },
      filterOutdated (kappa, records, cb) {
        cb = once(cb)
        let pending = records.length
        let filtered = []
        records.forEach(record => {
          kv.isLinked(record, (err, isOutdated) => {
            if (err) return cb(err)
            if (!isOutdated) filtered.push(record)
            if (--pending === 0) cb(null, records)
          })
        })
      }
    }
  }

  // function onupdate (msg) {
  //   console.log('onupdate', msg)
  // }
  // function onremove (msg) {
  //   console.log('onremove', msg)
  // }
}

function kvkey (record) {
  return record.schema + ':' + record.id
}
