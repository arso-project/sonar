import Client from '@arso-project/sonar-client'

import config from './config'

const endpoint = config.get('endpoint')
const island = config.get('island')

const client = new Client(endpoint, island)
export default client
