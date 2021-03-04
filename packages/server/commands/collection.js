const pump = require('pump')

module.exports = function createCollectionCommands (collections) {
  return {
    opts: {
      onopen (env, channel, cb) {
        if (!env.collection) return cb(new Error('Collection is required'))
        collections.get(env.collection, (err, collection) => {
          if (err) return cb(err)
          channel.collection = collection
          cb()
        })
      }
    },
    commands: {
      query: {
        title: 'Query',
        mode: 'streaming',
        args: [
          { name: 'name', title: 'Query name', type: 'string' },
          { name: 'args', title: 'Query arguments', type: 'object' },
          { name: 'opts', title: 'Options', type: 'object', items: queryStreamOpts }
        ],
        encoding: 'json',
        oncall (args, channel) {
          channel.reply()
          let [name, queryArgs, opts] = args
          if (!opts) opts = {}
          if (!queryArgs) queryArgs = {}
          const collection = channel.collection
          pump(collection.createQueryStream(name, queryArgs, opts), channel, err => {
            if (err) channel.error(err)
          })
        }
      },
      subscribe: {
        title: 'Subscribe',
        mode: 'streaming',
        encoding: 'json',
        args: [
          { name: 'name', title: 'Subscription name', type: 'string' },
          { name: 'opts', title: 'Options', type: 'object', items: subscriptionOpts }
        ],
        oncall (args, channel) {
          channel.reply()
          let [name, opts] = args
          opts = opts || {}
          const collection = channel.collection
          const subscription = collection.createSubscription(name, opts)
          pump(subscription.createPullStream({ live: true }), channel)
          channel.on('data', message => {
            const { cursor } = message
            if (cursor) {
              collection.ackSubscription(name, cursor, err => {
                if (err) channel.error(err)
              })
            } else {
              channel.error(new Error('Invalid message received'))
            }
          })
        }
      }
    }
  }
}

const queryStreamOpts = {
  live: { type: 'boolean', title: 'Live' }
}

const subscriptionOpts = {
  live: { type: 'boolean', title: 'Live', default: true },
  old: { type: 'boolean', title: 'Include past messages', default: true },
  filter: { type: 'object', title: 'Filter' }
}
