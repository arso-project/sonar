const { options, startServer } = require('./server')

exports.command = 'start'
exports.describe = 'start sonar'
exports.builder = options
exports.handler = startServer
