import Client from '@arso-project/sonar-client'

import config from './config'

const endpoint = config.get('endpoint')
const group = config.get('group')
const token = config.get('token')

const client = new Client(endpoint, group, { token })
window.__sonarClient = client
export default client
