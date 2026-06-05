import { io } from 'socket.io-client';
import { getAccessToken } from '../utils/authStorage';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || process.env.REACT_APP_API_BASE_URL || 'http://localhost:3010';

let socket = null;
let activeToken = '';

export function connectSocket() {
  const token = getAccessToken();

  if (!token) return null;

  if (socket && activeToken !== token) {
    socket.disconnect();
    socket = null;
  }

  activeToken = token;

  if (!socket) {
    socket = io(SOCKET_URL, {
      auth: { token },
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling'],
    });
  } else {
    socket.auth = { token };
  }

  if (!socket.connected) {
    socket.connect();
  }

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
  }

  socket = null;
  activeToken = '';
}

export function getSocket() {
  return socket;
}
