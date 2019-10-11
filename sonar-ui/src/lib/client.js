import Client from '@arso-project/sonar-client'

import config from './config'

const endpoint = config.get('endpoint')

const client = new Client(endpoint, 'default')

export default client
