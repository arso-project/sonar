const kData = Symbol('data')

class Version {
  constructor (data) {
    this[kData] = data
  }

  get raw () {
    return this[kData]
  }

  get path () {
    return `${this.raw.type}/${this.raw.id}`
  }

  get address () {
    return `${this.raw.key}/${this.raw.seq}`
  }

  get links () {
    return this.raw.links || []
  }
}
