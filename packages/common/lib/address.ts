export interface SchemaPath {
  namespace: string
  type: string
  field?: string
  version?: number
  /* @deprecated use type */
  name?: string

  [x: string]: unknown
}

export type SchemaPathInput = string | SchemaPath | {
  address: string
}

export function parseSchemaPath (address: SchemaPathInput): SchemaPath {
  if (!address) { throw new Error('Cannot parse empty address') }
  // Allow an object with address property
  if (typeof address === 'object' && typeof address.address === 'string') {
    address = address.address
    // Allow an object with { namespace, type, field, version } properties
  } else if (typeof address === 'object') {
    return parseSchemaPath(encodeSchemaPath(address as SchemaPath))
  }
  // Parse the address format. Example:
  // sonar/Entity@3#label
  const regex = /^(?:([^/#@]+)\/)?([^@#/]+)(?:@(\d+))?(?:#([^/#@]+))?$/
  const matches = address.match(regex)
  if (matches == null) { throw new Error('Invalid address') }
  matches.shift()
  const [namespace, type, versionString, field] = matches
  let version
  if (versionString) { version = parseInt(versionString) }
  return { namespace, type, field, version }
}

export function encodeSchemaPath (parts: SchemaPath) {
  let { namespace, type, field, version } = parts
  // TODO: Think if we want to accept both name and type
  if (!type && parts.name) { type = parts.name }
  if (!type || !validSegment(type)) {
    throw new Error('Cannot encode address: invalid type name')
  }
  if (namespace && !validSegment(namespace)) {
    throw new Error('Cannot encode address: invalid namespace')
  }
  if (field && !validSegment(field)) {
    throw new Error('Cannot encode address: invalid field name')
  }
  if (!version) { version = 0 }
  let address = ''
  if (namespace) { address += namespace + '/' }
  if (type) { address += type }
  if (version !== undefined) { address += '@' + version }
  if (field) { address += '#' + field }
  return address
}
function validSegment (segment: string) {
  return (!hasChar(segment, '/') && !hasChar(segment, '#') && !hasChar(segment, '@'))
}
function hasChar (str: string, char: string) {
  return str.includes(char)
}
