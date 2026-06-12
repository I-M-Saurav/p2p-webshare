// ============================================================
// server/index.js — Signaling Server for P2P WebShare
// Handles WebRTC signaling only. Never reads or stores file data.
// Uses Socket.io rooms to relay offer/answer/ICE between peers.
// ============================================================

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors()); // Allow cross-origin requests from the React frontend

// Create HTTP server and attach Socket.io to it
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' } // Accept connections from any origin (tighten in production)
});

// In-memory room registry: roomId -> { senderId, receiverId }
// Rooms are ephemeral — deleted when either peer disconnects
const rooms = {};

io.on('connection', (socket) => {
  console.log('🔌 connected:', socket.id);

  // --- ROOM MANAGEMENT ---

  // Sender creates a new room with a unique ID generated on the frontend
  socket.on('create-room', (roomId) => {
    rooms[roomId] = { senderId: socket.id, receiverId: null };
    socket.join(roomId);
    console.log(`📦 Room created: ${roomId} by ${socket.id}`);
  });

  // Receiver joins an existing room by ID
  socket.on('join-room', (roomId) => {
    const room = rooms[roomId];

    // Room doesn't exist — notify receiver
    if (!room) {
      socket.emit('room-not-found');
      return;
    }

    room.receiverId = socket.id;
    socket.join(roomId);
    console.log(`👤 Receiver joined room: ${roomId}`);

    // Notify sender that receiver is ready to begin WebRTC handshake
    io.to(room.senderId).emit('receiver-joined');
  });

  // --- WEBRTC SIGNALING RELAY ---
  // These events are just relayed to the other peer in the room.
  // The server never inspects the offer/answer/ICE content.

  // Relay SDP offer from sender to receiver
  socket.on('offer', ({ roomId, offer }) => {
    socket.to(roomId).emit('offer', offer);
  });

  // Relay SDP answer from receiver to sender
  socket.on('answer', ({ roomId, answer }) => {
    socket.to(roomId).emit('answer', answer);
  });

  // Relay ICE candidates between peers (needed for NAT traversal)
  socket.on('ice-candidate', ({ roomId, candidate }) => {
    socket.to(roomId).emit('ice-candidate', candidate);
  });

  // --- DISCONNECT HANDLING ---

  // When any peer disconnects, notify the other peer and clean up the room
  socket.on('disconnect', () => {
    console.log('❌ disconnected:', socket.id);

    for (const [roomId, room] of Object.entries(rooms)) {
      if (room.senderId === socket.id || room.receiverId === socket.id) {
        // Notify the remaining peer about disconnection
        socket.to(roomId).emit('peer-disconnected');
        delete rooms[roomId];
        console.log(`🗑️ Room ${roomId} cleaned up`);
      }
    }
  });
});
// Keep-alive: prevent Render free tier from spinning down
// Pings itself every 14 minutes
const RENDER_URL = process.env.RENDER_EXTERNAL_URL
if (RENDER_URL) {
  setInterval(() => {
    fetch(RENDER_URL).catch(() => {})
    console.log('🏓 Keep-alive ping sent')
  }, 14 * 60 * 1000)
}

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`🚀 Signaling server running on http://localhost:${PORT}`);
});
