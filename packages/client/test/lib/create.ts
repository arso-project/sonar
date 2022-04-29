// @ts-ignore
import Server from '@arsonar/server/test/lib/create.js'
import { Workspace } from '../../index.js'
export type CreateOneReturn = {
  client: Workspace,
  endpoint: string,
  cleanup: () => Promise<void>,
  server: any
}
export type CreateManyReturn = {
  endpoints: string[]
  clients: Workspace[]
  cleanup: () => Promise<void>,
  servers: any
}

async function createOne (opts: any = {}): Promise<CreateOneReturn> {
  const { server, endpoint, cleanup: cleanupServer } = await Server.createOne(opts)
  const clientOpts = opts.clientOpts || {}
  const client = new Workspace({ endpoint, ...clientOpts })
  return { server, cleanup, endpoint, client }
  async function cleanup () {
    await client.close()
    await cleanupServer()
  }
}
async function createMany (n: number, opts: any = {}): Promise<CreateManyReturn>  {
  const instances: any = await Server.createMany(n, opts)
  instances.clients = instances.endpoints.map((endpoint: string) => {
    return new Workspace({ endpoint })
  })
  const cleanup = instances.cleanup
  instances.cleanup = async function () {
    await Promise.all(instances.clients.map((client: Workspace) => client.close()))
    await cleanup()
  }
  return instances
}
export { createOne }
export { createMany }
export default {
  createOne,
  createMany
}
