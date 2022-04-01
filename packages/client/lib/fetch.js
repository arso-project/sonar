const fetch = require('isomorphic-fetch')
const debug = require('debug')('sonar:fetch')
const isBuffer = require('is-buffer')

module.exports = makeFetch

/**
 * Fetch a resource.
 *
 * This is a wrapper around the fetch web API. It should be API compatible to fetch,
 * with the following changes:
 *
 * TODO: Rethink the default responseType cascade.
 *
 * @async
 * @param {string} url - The url to fetch
 * @param {string} [opts.endpoint=''] Endpoint URL (will be prefixed to URL)
 * @param {string} [opts.requestType='json'] Request encoding and content type.
 *   Supported values are 'json' and 'binary'
 * @param {string} [opts.responseType='text'] Response encoding. If the response
 *    has a JSON content type, will always be set to 'json'.
 *    Supported values are 'text', 'binary' and 'stream'.
 * @param {object} [opts.params] Query string parameters (will be encoded correctly).
 *
 * @return {Promise<object>} If the response has a JSON content type header, the
 *    decoded JSON will be returned. if opts.responseType is 'binary' or 'text',
 *    the response will be returned as a buffer or text.
 */
async function makeFetch (url, opts) {
  if (!url.match(/^https?:\/\//)) {
    if (url.indexOf('://') !== -1) {
      throw new Error('Only http: and https: protocols are supported.')
    }
    if (!url.startsWith('/')) url = '/' + url
    if (opts.endpoint) url = opts.endpoint + url
  }

  if (!opts.headers) opts.headers = {}
  if (!opts.requestType) {
    if (isBuffer(opts.body)) opts.requestType = 'buffer'
    else opts.requestType = 'json'
  }

  if (opts.params) {
    const searchParams = new URLSearchParams()
    for (const [key, value] of Object.entries(opts.params)) {
      searchParams.append(key, value)
    }
    url += '?' + searchParams.toString()
  }

  if (opts.requestType === 'json') {
    opts.body = JSON.stringify(opts.body)
    opts.headers['content-type'] = 'application/json'
  }
  if (opts.requestType === 'buffer') {
    opts.headers['content-type'] = 'application/octet-stream'
  }

  const log = opts.log === false ? () => {} : opts.log || debug

  try {
    debug('fetch', url, opts)
    const res = await fetch(url, opts)
    if (!res.ok) {
      let message
      if (isJsonResponse(res)) {
        message = (await res.json()).error
      } else {
        message = await res.text()
      }
      log(`error ${res.status} ${url}`)
      throw new Error('Remote error (code ' + res.status + '): ' + message)
    }

    log(`ok ${res.status} fetch ${url}`)

    if (opts.responseType === 'raw') {
      return res
    }
    if (opts.responseType === 'stream') {
      return res.body
    }
    if (opts.responseType === 'buffer') {
      // nodejs only: res.buffer() returns a Buffer instance.
      if (res.buffer) return await res.buffer()
      // browser: Fetch API res.arrayBuffer returns ArrayBuffer.
      else return await res.arrayBuffer()
    }

    if (isJsonResponse(res)) {
      return await res.json()
    }

    return await res.text()
  } catch (err) {
    // TODO: If error fails for insufficient authorization, try creating
    // a new token if accessCode is set
    debug('fetch error', err)
    log(`error: fetch ${url} ${err.message}`)
    throw err
  }
}

function isJsonResponse (res) {
  const header = res.headers.get('content-type')
  if (!header) return false
  return header.indexOf('application/json') !== -1
}
