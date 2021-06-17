// This would live in sonar-core
//
const { NanoresourcePromise: Nanoresource } = require('nanoresource-promise/emitter')
const { CollectionStore } = require('@arso-project/sonar-core')
const maybe = require('call-me-maybe')

const PROMISE_WRAPPED = Symbol('promise-wrapped')

module.exports = class Collections extends Nanoresource {
  constructor (opts = {}) {
    super()
    const path = '/tmp/sonarfoo1'
    this.store = new CollectionStore(path)
  }

  async open () {
    return new Promise((resolve, reject) => {
      this.store.open(err => err ? reject(err) : resolve())
    })
  }

  async get ({ key, name }) {
    if (!this.opened) await this.open()
    const opts = { create: true }

    return new Promise((resolve, reject) => {
      this.store.get(key || name, opts, (err, collection) => {
        if (err) {
          this.store.create(name, { key, alias: name }, (err, collection) => {
            if (err) return reject(err)
            resolve(wrapCollection(collection))
          })
        }
        resolve(wrapCollection(collection))
      })
    })
  }

  // async create ({ key, name }) {
  //   if (!this.opened) await this.open()
  //   return new Promise((resolve, reject) => {
  //     this.store.get(key || name, (err, collection) => {
  //       if (err) return reject(err)
  //       resolve(wrapCollection(collection))
  //     })
  //   })
  // }
}

function wrapCollection (collection) {
  wrapObject(collection, [
    'open', 'query', 'put'
  ])
  collection.publish = collection.put.bind(collection)

  // if (collection[PROMISE_WRAPPED]) return collection
  // const open = bind(collection, collection.open)
  // collection.open = () => new Promise((resolve, reject) => {
  //   open(err => err ? reject(err) : resolve())
  // })
  // collection.ready = collection.open

  // const query = bind(collection, collection.query)
  // collection.query = (...args) => new Promise((resolve, reject) => {
  //   query(...args, (err, res) => err ? reject(err) : resolve(res))
  // })

  // const publish = bind(collection, collection.put)
  // collection.publish = (...args) => new Promise((resolve, reject) => {
  //   publish(...args, (err, res) => err ? reject(err) : resolve(res))
  // })
  return collection
}

function wrapObject (obj, methods) {
  if (obj[PROMISE_WRAPPED]) return obj
  for (const method of methods) {
    wrap(obj, method)
  }
  return obj
}

function wrap (obj, method) {
  const boundMethod = bind(obj, obj[method])
  obj[method] = function (...args) {
    if (typeof args[args.length - 1] === 'function') {
      return boundMethod(...args)
    }
    return new Promise((resolve, reject) => {
      boundMethod(...args, (err, ...res) => {
        if (err) return reject(err)
        if (res.length === 1) return resolve(res[0])
        resolve(res)
      })
    })
  }
  obj[method] = obj[method].bind(obj)
}

function bind (obj, method) {
  return method.bind(obj)
}
