import reactRefresh from '@vitejs/plugin-react-refresh'

export default {
  plugins: [reactRefresh()],
  optimizeDeps: {
    include: ['@arsonar/common']
  },
  define: {
    'process.env': {}
  },
  build: {
    minify: false,
    rollupOptions: {
      output: {
        intro: `
          // minimal browser mocks needed for some nodejs modules
          if (window) {
            window.global = window
            window.process = {}
          }
        `
      }
    }
  }
}
