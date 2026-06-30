import { verifySocketToken } from './auth.js';
import pool from './db.js';

export function initSocket(io) {
  // Auth middleware for Socket.io
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      socket.user = verifySocketToken(token);
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.name} (${socket.id})`);

    // Broadcast to others that someone joined
    socket.broadcast.emit('user:joined', { name: socket.user.name });

    // Task created — broadcast to all other clients
    socket.on('task:created', (task) => {
      socket.broadcast.emit('task:created', task);
    });

    // Task updated (edit or drag-drop)
    socket.on('task:updated', (task) => {
      socket.broadcast.emit('task:updated', task);
    });

    // Task deleted
    socket.on('task:deleted', ({ id }) => {
      socket.broadcast.emit('task:deleted', { id });
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user.name}`);
      io.emit('user:left', { name: socket.user.name });
    });
  });
}