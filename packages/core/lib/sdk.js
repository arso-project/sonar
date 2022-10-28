module.exports = async function createSDK (opts = {}) {
  opts.autoJoin = false
  const { create } = await import('hyper-sdk')
  const sdk = await create(opts)
  return sdk
}
