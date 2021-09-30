import { EventEmitter } from 'events'
export class Config extends EventEmitter {
  constructor (prefix) {
    super()
    this.prefix = prefix
    this.config = {}
  }

  set (key, value) {
    console.log('SET', key, value)
    this.config[key] = value
    window.localStorage.setItem(key, JSON.stringify(value))
    this.emit('update')
  }

  get (key, defaultValue) {
    if (typeof this.config[key] === 'undefined') {
      const item = window.localStorage.getItem(key)
      if (item !== null) {
        try {
          this.config[key] = JSON.parse(item)
        } catch (e) {}
      }
    }
    return typeof this.config[key] === 'undefined'
      ? defaultValue
      : this.config[key]
  }
}

// const config = new Config()
// export default config
