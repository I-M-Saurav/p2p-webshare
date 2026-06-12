// socket.js — Singleton Socket.io client instance
// Uses environment variable for server URL in production,
// falls back to localhost for development
import { io } from 'socket.io-client'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'

export const socket = io(SERVER_URL)