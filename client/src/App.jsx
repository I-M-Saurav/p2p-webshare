import { useState } from 'react'
import { useWebRTC } from './hooks/useWebRTC'
import Sender from './components/Sender'
import Receiver from './components/Receiver'

// Main App — lets user choose between sending or receiving a file
export default function App() {
  const [mode, setMode] = useState(null) // 'sender' | 'receiver' | null

  const {
    roomId,
    connectionStatus,
    transferProgress,
    transferSpeed,
    receivedFile,
    peerDisconnected,
    createRoom,
    joinRoom,
  } = useWebRTC()

  // Auto-detect receiver mode if URL has ?room=XXXX
  useState(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('room')) setMode('receiver')
  })

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">

      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚡</span>
          <span className="text-xl font-bold text-violet-400 tracking-tight">P2P WebShare</span>
        </div>
        <span className="text-xs text-gray-500 font-mono">Direct · Encrypted · No Server Storage</span>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-6">

        {/* Mode selection screen */}
        {!mode && (
          <div className="text-center space-y-8 max-w-md w-full">
            <div>
              <h1 className="text-4xl font-bold text-white mb-3">Share files instantly</h1>
              <p className="text-gray-400 text-lg">
                Browser-to-browser. No uploads. No cloud. Just direct P2P transfer.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Send button */}
              <button
                onClick={() => setMode('sender')}
                className="bg-violet-600 hover:bg-violet-700 text-white rounded-2xl p-6 flex flex-col items-center gap-3 transition-all duration-200 hover:scale-105"
              >
                <span className="text-4xl">📤</span>
                <span className="font-semibold text-lg">Send</span>
                <span className="text-violet-300 text-xs">Share a file</span>
              </button>

              {/* Receive button */}
              <button
                onClick={() => setMode('receiver')}
                className="bg-gray-800 hover:bg-gray-700 text-white rounded-2xl p-6 flex flex-col items-center gap-3 transition-all duration-200 hover:scale-105 border border-gray-700"
              >
                <span className="text-4xl">📥</span>
                <span className="font-semibold text-lg">Receive</span>
                <span className="text-gray-400 text-xs">Enter a Room ID</span>
              </button>
            </div>

            {/* How it works */}
            <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800 text-left space-y-3">
              <p className="text-gray-400 text-sm font-medium">How it works</p>
              <div className="space-y-2 text-sm text-gray-500">
                <p>1️⃣  Sender drops a file → gets a Room ID</p>
                <p>2️⃣  Share the Room ID or invite link</p>
                <p>3️⃣  Receiver enters Room ID → file transfers directly</p>
                <p>🔒  SHA-256 verified · server never sees your file</p>
              </div>
            </div>
          </div>
        )}

        {/* Sender view */}
        {mode === 'sender' && (
          <Sender
            onFileSelect={(file) => createRoom(file)}
            roomId={roomId}
            connectionStatus={connectionStatus}
            transferProgress={transferProgress}
            transferSpeed={transferSpeed}
            peerDisconnected={peerDisconnected}
          />
        )}

        {/* Receiver view */}
        {mode === 'receiver' && (
          <Receiver
            onJoin={(id) => joinRoom(id)}
            connectionStatus={connectionStatus}
            transferProgress={transferProgress}
            transferSpeed={transferSpeed}
            receivedFile={receivedFile}
            peerDisconnected={peerDisconnected}
          />
        )}
      </main>

      {/* Footer — back button when in a mode */}
      {mode && (
        <footer className="border-t border-gray-800 px-6 py-4 text-center">
          <button
            onClick={() => window.location.reload()}
            className="text-gray-500 hover:text-gray-300 text-sm transition"
          >
            ← Back to home
          </button>
        </footer>
      )}
    </div>
  )
}
