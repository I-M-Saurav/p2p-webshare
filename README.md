# ⚡ P2P WebShare

A lightweight, decentralized browser-to-browser file sharing web application built with WebRTC. Files transfer **directly** between browsers — the server only coordinates the initial handshake and never reads, processes, or stores any file data.

## 🚀 Live Demo

- **Frontend:** [coming soon]
- **Backend Signaling Server:** [coming soon]

## ✨ Features

- 📤 **Drag & drop** file selection with 50MB limit enforcement
- 🔗 **Unique Room ID** generation + one-click invite link copy
- ⚡ **Direct P2P transfer** via WebRTC Data Channels — no server middleman
- 🔒 **SHA-256 integrity verification** — every file is hashed before and after transfer
- 📊 **Real-time progress** — transfer percentage + speed (MB/s)
- 📥 **Auto-download** — file saves automatically when transfer completes
- ⚠️ **Graceful disconnect** — clean UI notification if either peer drops
- 🔗 **Invite link support** — Room ID auto-fills when receiver opens the link

## 🏗️ Architecture

[Sender Browser] ──── WebRTC Data Channel (direct P2P) ────► [Receiver Browser]
│ │
└──────────── Socket.io (signaling only) ────────────────────┘
│
[Node.js Server]
(never sees file data)

## 🛠️ Tech Stack

| Layer              | Technology                          |
| ------------------ | ----------------------------------- |
| Frontend           | React.js, Vite, Tailwind CSS        |
| P2P Communication  | WebRTC API (native), FileReader API |
| File Integrity     | Web Crypto API (SHA-256)            |
| Signaling Backend  | Node.js, Express.js, Socket.io      |
| Hosting (Frontend) | Vercel                              |
| Hosting (Backend)  | Render                              |

## 📁 Project Structure

p2p-webshare/
├── client/ # React frontend
│ ├── src/
│ │ ├── components/
│ │ │ ├── Sender.jsx # File selection + room creation UI
│ │ │ └── Receiver.jsx # Room joining + file receive UI
│ │ ├── hooks/
│ │ │ └── useWebRTC.js # Core WebRTC + transfer logic
│ │ ├── socket.js # Socket.io singleton client
│ │ └── App.jsx # Root component + mode selection
│ └── index.html
├── server/
│ └── index.js # Signaling server (Socket.io)
└── README.md

## ⚙️ Local Setup

### Prerequisites

- Node.js v18+
- npm

### Steps

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/p2p-webshare.git
cd p2p-webshare

# 2. Install dependencies
cd server && npm install
cd ../client && npm install

# 3. Start the signaling server (terminal 1)
cd server && npm run dev

# 4. Start the frontend (terminal 2)
cd client && npm run dev

# 5. Open http://localhost:5173
```

## 🔄 How It Works

1. **Sender** drops a file → a unique Room ID is generated → signaling server registers the room
2. **Sender** shares the Room ID or invite link with the receiver
3. **Receiver** enters the Room ID → joins the room via signaling server
4. **WebRTC handshake** — offer/answer/ICE candidates relayed through signaling server
5. **Direct P2P connection** established — signaling server is no longer involved
6. **File is chunked** (16KB chunks), SHA-256 hashed, and streamed over the data channel
7. **Receiver reassembles** chunks, verifies SHA-256 hash, and auto-downloads the file

## 📊 Evaluation Metrics

| Metric              | Implementation                                  |
| ------------------- | ----------------------------------------------- |
| File Integrity      | SHA-256 hash verified before and after transfer |
| Progress Tracking   | Real-time % + MB/s speed indicator              |
| Disconnect Handling | Graceful UI notification via Socket.io event    |
| Security            | Signaling server never accesses file data       |

## 📝 License

MIT
