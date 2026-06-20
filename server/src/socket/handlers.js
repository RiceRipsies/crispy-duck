import jwt from 'jsonwebtoken';
import { JWT_SECRET_KEY } from '../middleware/auth.js';

export function setupSocket(io) {
  io.use((socket, next) => {
    // Cookie-based auth: extract JWT from the httpOnly cookie sent with the WS handshake
    const cookieHeader = socket.request.headers.cookie ?? '';
    const token = cookieHeader
      .split(';')
      .find(c => c.trim().startsWith('token='))
      ?.split('=')[1];

    if (!token) return next(new Error('Authentication required'));
    try {
      socket.data.user = jwt.verify(token, JWT_SECRET_KEY);
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    socket.join('restaurant');
    socket.on('disconnect', () => {});
  });
}
