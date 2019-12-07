import Client from '@arso-project/sonar-client'

import config from './config'

const endpoint = config.get('endpoint')
const island = config.get('island')

const client = new Client(endpoint, island)
window.__sonarClient = client
export default client
