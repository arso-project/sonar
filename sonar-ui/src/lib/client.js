import Client from '@arsonar/client'

import config from './config'

const endpoint = config.get('endpoint')
const collection = config.get('collection')
const token = config.get('token')
const accessCode = config.get('accessCode')

const client = new Client({ endpoint, collection, token, accessCode })
window.__sonarClient = client
export default client
