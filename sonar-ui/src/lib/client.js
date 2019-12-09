import Client from '@arso-project/sonar-client'

import config from './config'

const endpoint = config.get('endpoint')
const island = config.get('island')
const token = config.get('token')

const client = new Client(endpoint, island, { token })
window.__sonarClient = client
export default client
