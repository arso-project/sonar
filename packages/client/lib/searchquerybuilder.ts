import type { Schema } from '@arsonar/common/dist/cjs'

export class SearchQueryBuilder {
  schema: string 
  query: any
  limit?: number
  constructor (schema: string) {
    this.schema = schema
    this.query = {}
  }

  bool (boolType: string, queries: any) {
    if (!this.query.hasOwnProperty('bool')) {
      this.query.bool = {}
    }
    this.query.bool[boolType] = queries
    return this
  }

  phrase (field: string, terms: any) {
    if (!this.query.hasOwnProperty('phrase')) {
      this.query.phrase = {}
    }
    this.query.phrase[field] = { terms }
    return this
  }

  setLimit (limit: number) {
    this.limit = limit
    return this
  }

  term (field: string, value: string) {
    return { term: { [field]: value } }
  }

  getQuery () {
    return { query: this.query, limit: this.limit }
  }
}
