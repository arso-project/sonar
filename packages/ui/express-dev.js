const p = require('path')
const fs = require('fs')
const { createServer: createViteServer } = require('vite')

// Taken from https://vitejs.dev/guide/ssr.html#setting-up-the-dev-server
module.exports = async function addDevServer (app, opts = {}) {
  const vite = await createViteServer({
    root: __dirname,
    server: { middlewareMode: 'ssr' }
  })

  app.use(vite.middlewares)

  app.use('*', async (req, res) => {
    const url = req.originalUrl

    try {
      // 1. Read index.html
      let template = fs.readFileSync(
        p.resolve(__dirname, 'index.html'),
        'utf-8'
      )

      template = await vite.transformIndexHtml(url, template)
      res
        .status(200)
        .set({ 'Content-Type': 'text/html' })
        .end(template)
    } catch (e) {
      vite.ssrFixStacktrace(e)
      console.error(e)
      res.status(500).end(e.message)
    }
  })
}
