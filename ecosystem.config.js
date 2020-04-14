// Start with `pm2 start ecosystem.config.js`
module.exports = {
  apps: [
    {
      name: 'server',
      script: './sonar-server/bin.js',
      args: 'server start',
      instances: 1,
      // autorestart: true,
      // max_restarts: 1,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development'
        // DEBUG: '*'
      },
      env_production: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'ui',
      script: './sonar-ui/bin.js',
      args: 'start',
      instances: 1,
      // autorestart: true,
      // max_restarts: 1,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development'
      },
      env_production: {
        NODE_ENV: 'production'
      }
    }
  ]
}
