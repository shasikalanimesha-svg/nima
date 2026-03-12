module.exports = {
  apps: [{
    name: 'shasi',
    script: 'index.js',
    cwd: '',
    watch: false,
    max_restarts: 50,
    restart_delay: 3000,
    min_uptime: '10s',
    autorestart: true,
    node_args: '--max-old-space-size=512',
    env: {
      NODE_ENV: 'production'
    }
  }]
}
