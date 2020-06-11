import Client from '@arso-project/sonar-client'

import config from './config'

const endpoint = config.get('endpoint')
const collection = config.get('collection')
const token = config.get('token')

const client = new Client({ endpoint, collection, token })
window.__sonarClient = client
export default client
