// Receiver component — joins a room and receives the file
import { useState } from 'react'
export default function Receiver({ onJoin, connectionStatus, transferProgress, transferSpeed, receivedFile, peerDisconnected }) {
  const [inputId, setInputId] = useState('')
  const [joined, setJoined] = useState(false)

  // Extract room ID from URL if present (when user clicks invite link)
  useState(() => {
    const params = new URLSearchParams(window.location.search)
    const room = params.get('room')
    if (room) { setInputId(room) }
  })

  function handleJoin() {
    if (!inputId.trim()) return
    setJoined(true)
    onJoin(inputId.trim().toUpperCase())
  }

  // Format bytes
  function formatSize(bytes) {
    if (!bytes) return ''
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / 1024 / 1024).toFixed(1) + ' MB'
  }

  return (
    <div className="w-full max-w-lg mx-auto">
      <h2 className="text-2xl font-bold text-violet-400 mb-6 text-center">Receive a File</h2>

      {/* Room ID input */}
      {!joined && (
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-700 space-y-4">
          <p className="text-gray-400 text-sm text-center">Enter the Room ID shared by the sender</p>
          <input
            type="text"
            value={inputId}
            onChange={(e) => setInputId(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            placeholder="e.g. A3F9KL"
            maxLength={6}
            className="w-full bg-gray-800 text-white text-center text-2xl font-mono tracking-widest rounded-xl py-4 px-4 border border-gray-600 focus:outline-none focus:border-violet-500"
          />
          <button
            onClick={handleJoin}
            className="w-full bg-violet-600 hover:bg-violet-700 text-white font-medium py-3 rounded-xl transition"
          >
            Join Room →
          </button>
        </div>
      )}

      {/* Waiting / progress state after joining */}
      {joined && (
        <div className="space-y-4">
          <div className="bg-gray-900 rounded-2xl p-4 border border-gray-700">
            <p className="text-gray-400 text-sm mb-1">Room ID</p>
            <p className="text-violet-300 font-mono text-2xl font-bold tracking-widest">{inputId}</p>
          </div>

          {/* Connection status */}
          <div className="bg-gray-900 rounded-2xl p-4 border border-gray-700">
            <StatusBadge status={connectionStatus} peerDisconnected={peerDisconnected} />
          </div>

          {/* Transfer progress bar */}
          {transferProgress > 0 && (
            <div className="bg-gray-900 rounded-2xl p-4 border border-gray-700 space-y-2">
              <div className="flex justify-between text-sm text-gray-400">
                <span>Receiving...</span>
                <span>{transferProgress}% · {transferSpeed} MB/s</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-3">
                <div
                  className="bg-green-500 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${transferProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* File received successfully */}
          {receivedFile && (
            <div className="bg-green-950 border border-green-700 rounded-2xl p-4 text-center space-y-1">
              <p className="text-green-400 font-semibold text-lg">✅ File received!</p>
              <p className="text-green-300 text-sm">{receivedFile.name}</p>
              <p className="text-green-500 text-xs">{formatSize(receivedFile.size)} · SHA-256 verified ✓</p>
            </div>
          )}

          {/* Hash mismatch error */}
          {connectionStatus === 'hash-mismatch' && (
            <div className="bg-red-950 border border-red-700 rounded-2xl p-4 text-red-300 text-sm text-center">
              ❌ File integrity check failed! The file may be corrupted.
            </div>
          )}

          {/* Peer disconnected */}
          {peerDisconnected && (
            <div className="bg-red-950 border border-red-700 rounded-2xl p-4 text-red-300 text-sm text-center">
              ⚠️ Sender disconnected from the session.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Status badge — same pattern as Sender
function StatusBadge({ status, peerDisconnected }) {
  if (peerDisconnected) return <p className="text-red-400 text-sm">🔴 Peer disconnected</p>

  const map = {
    idle:      ['🔵', 'text-blue-400',   'Idle'],
    connecting:['🟠', 'text-orange-400', 'Connecting to sender...'],
    connected: ['🟢', 'text-green-400',  'Connected — receiving file...'],
    done:      ['✅', 'text-green-400',  'Transfer complete!'],
    'room-not-found': ['🔴', 'text-red-400', 'Room not found. Check the ID.'],
    failed:    ['🔴', 'text-red-400',    'Connection failed'],
  }

  const [icon, color, label] = map[status] || ['🔵', 'text-gray-400', status]
  return <p className={`text-sm font-medium ${color}`}>{icon} {label}</p>
}