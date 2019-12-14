# Sonar-server

A HTTP server with a REST style API for Sonar.

## Usage

`node bin.js server start` start the server. If installed globally, this is the same as `sonar server start`. The server listens on port 9191 by default, and only on localhost (not exposed publicly).

The server is only intended to be run on localhost, and not for being reachable over public networks. There's no authentication built in yet. We'll add token based authentication soon.
