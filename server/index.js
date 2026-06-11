const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// roomId -> { senderId, receiverId }
const rooms = {};

io.on('connection', (socket) => {
  console.log('🔌 connected:', socket.id);

  // Sender creates a room
  socket.on('create-room', (roomId) => {
    rooms[roomId] = { senderId: socket.id, receiverId: null };
    socket.join(roomId);
    console.log(`📦 Room created: ${roomId} by ${socket.id}`);
  });

  // Receiver joins a room
  socket.on('join-room', (roomId) => {
    const room = rooms[roomId];
    if (!room) {
      socket.emit('room-not-found');
      return;
    }
    room.receiverId = socket.id;
    socket.join(roomId);
    console.log(`👤 Receiver joined room: ${roomId}`);
    // Tell sender that receiver is ready
    io.to(room.senderId).emit('receiver-joined');
  });

  // WebRTC signaling relay — offer, answer, ice-candidate
  socket.on('offer', ({ roomId, offer }) => {
    socket.to(roomId).emit('offer', offer);
  });

  socket.on('answer', ({ roomId, answer }) => {
    socket.to(roomId).emit('answer', answer);
  });

  socket.on('ice-candidate', ({ roomId, candidate }) => {
    socket.to(roomId).emit('ice-candidate', candidate);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('❌ disconnected:', socket.id);
    for (const [roomId, room] of Object.entries(rooms)) {
      if (room.senderId === socket.id || room.receiverId === socket.id) {
        socket.to(roomId).emit('peer-disconnected');
        delete rooms[roomId];
        console.log(`🗑️ Room ${roomId} cleaned up`);
      }
    }
  });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`🚀 Signaling server running on http://localhost:${PORT}`);
});