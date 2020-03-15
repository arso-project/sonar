// const { hyperdriveHandler } = require('./hyperdrive')
const hyperdriveMiddleware = require('./hyperdrive')
const collect = require('collect-stream')
const { Router } = require('simple-rpc-protocol')
const express = require('express')
const websocketStream = require('websocket-stream/stream')
const debug = require('debug')
const log = debug('sonar:server')

module.exports = function apiRoutes (api) {
  const router = express.Router()

  // Top level actions
  const deviceHandlers = createDeviceHandlers(api.groups)
  const handlers = createGroupHandlers(api.groups)
  const commandHandler = createCommandHandler(api.groups)

  // Info
  router.get('/_info', deviceHandlers.info)
  // Create group
  router.put('/_create/:name', deviceHandlers.createGroup)

  const groupRouter = express.Router()
  // Change group config
  groupRouter.patch('/', deviceHandlers.updateGroup)
  // Create command stream (websocket)
  groupRouter.ws('/commands', commandHandler)

  // Hyperdrive actions (get and put)
  groupRouter.use('/fs', hyperdriveMiddleware(api.groups))

  // Create or update record
  groupRouter.put('/db', handlers.put)
  groupRouter.put('/db/:schema/:id', handlers.put)
  groupRouter.get('/db/:key/:seq', handlers.get)
  // Get record
  // groupRouter.get('/db/:schemans/:schemaname/:id', handlers.get)

  // Search/Query
  groupRouter.post('/_query/:name', handlers.query)
  // List schemas
  groupRouter.get('/schema', handlers.getSchemas)
  // Put schema
  groupRouter.post('/schema', handlers.putSchema)
  // Put source
  // TODO: This route should have the same pattern as the others.
  groupRouter.put('/source/:key', handlers.putSource)

  groupRouter.get('/debug', handlers.debug)

  groupRouter.get('/fs-info', function (req, res, next) {
    const { group } = req
    group.query('records', { schema: 'core/source' }, (err, records) => {
      if (err) return next(err)
      const drives = records
        .filter(record => record.value.type === 'hyperdrive')
        .map(record => record.value)
      let pending = drives.length
      drives.forEach(driveInfo => {
        group.fs.get(driveInfo.key, (err, drive) => {
          driveInfo.writable = drive.writable
          if (--pending === 0) res.send(drives)
        })
      })
      // res.send(drives)
    })
  })

  // Load group if in path.
  router.use('/:group', function (req, res, next) {
    const { group } = req.params
    res.locals.key = group;
    if (!group) return next()
    api.groups.get(group, (err, group) => {
      if (err) return next(err)
      req.group = group
      next()
    })
  }, groupRouter)

  return router
}

function createCommandHandler (groups) {
  const router = new Router({ name: 'server' })
  // router.command('ping', (args, channel) => {
  //   channel.reply('pong')
  //   channel.end()
  // })
  router.on('error', log)
  return function createCommandStream (ws, req) {
    // const { key } = req.params
    const stream = websocketStream(ws, {
      binary: true
    })
    stream.on('error', err => {
      log(err)
    })
    router.connection(stream)
  }
}

function createDeviceHandlers (groups) {
  return {
    info (req, res, next) {
      groups.status((err, status) => {
        if (err) return next(err)
        res.send(status)
      })
    },
    createGroup (req, res, next) {
      const { name } = req.params
      const { key, alias } = req.body
      groups.create(name, { key, alias }, (err, group) => {
        if (err) return next(err)
        res.send({
          key: group.key.toString('hex')
        })
      })
    },
    updateGroup (req, res, next) {
      let config = {};
      if (req.body.hasOwnProperty('share')) {
        config = groups.updateGroup(res.locals.key, req.body) 
      }
      res.send(config)
    }
  }
}

// These handlers all expect a req.group property.
function createGroupHandlers () {
  return {
    put (req, res, next) {
      let record
      if (req.params.schema) {
        record = {
          id: req.params.id,
          schema: req.params.schema,
          value: req.body
        }
      } else {
        record = req.body
      }
      req.group.put(record, (err, id) => {
        if (err) return next(err)
        res.send({ id })
      })
    },

    get (req, res, next) {
      const { key, seq } = req.params
      req.group.loadRecord({ key, seq }, (err, record) => {
        if (err) return next(err)
        res.send(record)
      })
    },

    // TODO: This should be something different than get
    // and intead drive different kinds of queries.
    query (req, res, next) {
      const name = req.params.name
      const args = req.body
      const opts = req.query || {}
      req.group.query(name, args, opts, (err, records) => {
        if (err) return next(err)
        res.send(records)
      })
    },

    getSchemas (req, res, next) {
      if (req.query && req.query.name) {
        const schema = req.group.getSchema(req.query.name)
        if (!schema) return next(HttpError(404, 'Schema not found'))
        else res.send(schema)
      } else {
        const schemas = req.group.getSchemas()
        res.send(schemas)
      }
    },

    putSchema (req, res, next) {
      const schema = req.body
      const name = schema.name
      const group = req.group
      group.putSchema(name, schema, (err, id) => {
        if (err) {
          err.statusCode = 400
          return next(err)
        }
        group.getSchema(name, (err, result) => {
          if (err) return next(err)
          res.send(result)
        })
      })
    },

    putSource (req, res, next) {
      const { key } = req.params
      const info = req.body
      req.group.putSource(key, info, (err) => {
        if (err) return next(err)
        return res.send({ msg: 'ok' })
      })
    },

    debug (req, res, next) {
      return res.end('not implemented')
    }
  }
}

function HttpError (code, message) {
  let err
  if (message instanceof Error) err = message
  else err = new Error(message)
  errr.statusCode = code
  return err
}

function expandSchema (group, { schemans, schemaname }) {
  if (!schemans || !schemaname) return null
  if (schemans === '_') schemans = group.key.toString('hex')
  const schema = schemans + '/' + schemaname
  return schema
}

function replyStream (res, stream) {
  const results = []
  let error = false
  stream.on('data', data => results.push(data))
  stream.on('error', err => (error = err))
  stream.on('close', () => {
    if (error) res.status(422).send({ error })
  })
  stream.on('end', () => {
    res.send(results)
  })
}
