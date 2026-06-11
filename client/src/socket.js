// socket.js — Singleton Socket.io client instance
// Exported and shared across the app so only one connection is made.
// In production, replace the URL with the deployed backend URL via env variable.

import { io } from 'socket.io-client'

export const socket = io('http://localhost:3001')
