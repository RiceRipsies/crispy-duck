import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { JWT_SECRET_KEY } from '../middleware/auth.js';

export function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: 'http://localhost:5173', credentials: true },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.request.headers.cookie
      ?.split(';').find(c => c.trim().startsWith('token='))?.split('=')[1];

    if (!token) return next(new Error('Unauthorized'));
    try {
      socket.user = jwt.verify(token, JWT_SECRET_KEY);
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    socket.join('restaurant');
    socket.on('disconnect', () => {});
  });

  return io;
}
