import { verifySocketToken } from './auth.js';
import pool from './db.js';

export function initSocket(io) {
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
    console.log(`Connected: ${socket.user.name}`);

    // Client tells us which board they're on right after connecting
    socket.on('board:join', ({ teamId }) => {
      // Leave any previous board room first
      const prevRoom = socket.currentRoom;
      if (prevRoom) socket.leave(prevRoom);

      // Personal board = private room per user, team board = shared room per team
      const room = teamId ? `team:${teamId}` : `user:${socket.user.id}`;
      socket.join(room);
      socket.currentRoom = room;
      console.log(`${socket.user.name} joined room: ${room}`);
    });

    socket.on('task:created', (task) => {
      if (socket.currentRoom) socket.to(socket.currentRoom).emit('task:created', task);
    });

    socket.on('task:updated', (task) => {
      if (socket.currentRoom) socket.to(socket.currentRoom).emit('task:updated', task);
    });

    socket.on('task:deleted', ({ id }) => {
      if (socket.currentRoom) socket.to(socket.currentRoom).emit('task:deleted', { id });
    });

    socket.on('disconnect', () => {
      console.log(`Disconnected: ${socket.user.name}`);
    });
  });
}