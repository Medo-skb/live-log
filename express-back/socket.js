const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
require('dotenv').config();

let io = null;

function getAllowedOrigin() {
  return process.env.FRONT_PUBLIC_URL
    || process.env.CLIENT_PUBLIC_URL
    || process.env.CORS_ORIGIN
    || process.env.REACT_APP_PUBLIC_URL
    || 'http://localhost:3000';
}

function getUserRoom(userId) {
  return 'user:' + userId;
}

function extractToken(socket) {
  const authToken = socket.handshake.auth?.token;
  const header = socket.handshake.headers?.authorization || '';
  const headerToken = header.startsWith('Bearer ') ? header.slice(7) : '';

  return authToken || headerToken || '';
}

function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: getAllowedOrigin(),
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token = extractToken(socket);

    if (!token) {
      return next(new Error('AUTH_REQUIRED'));
    }

    try {
      const user = jwt.verify(token, process.env.jwt_key);
      socket.user = user;
      return next();
    } catch (error) {
      return next(new Error('AUTH_INVALID'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user?.userId;

    if (userId) {
      socket.join(getUserRoom(userId));
    }
  });

  return io;
}

function emitToUser(userId, eventName, payload) {
  if (!io || !userId) return;
  io.to(getUserRoom(userId)).emit(eventName, payload);
}

function getSocketServer() {
  return io;
}

module.exports = {
  emitToUser,
  getSocketServer,
  getUserRoom,
  initSocket,
};
