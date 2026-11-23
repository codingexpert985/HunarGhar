'use strict';
const http = require('http');
const { Server } = require('socket.io');
const env = require('./config/env');
const app = require('./app');
const attachChat = require('./sockets/chat');

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: env.NODE_ENV === 'production' ? env.CLIENT_URLS : true, credentials: true }
});
app.set('io', io);          // lets REST routes push events (new_message, booking_status)
attachChat(io);

server.listen(env.PORT, () => {
  console.log(`HunarGhar API running on http://localhost:${env.PORT}  (${env.NODE_ENV})`);
  console.log(`Demo page : http://localhost:${env.PORT}/`);
  console.log(`Health    : http://localhost:${env.PORT}/api/health`);
});

process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', e));
