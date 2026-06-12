import { useState } from 'react'

// Receiver component — lets user enter a Room ID to join a P2P session
// and displays real-time transfer progress + file receipt confirmation.
export default function Receiver({ onJoin, connectionStatus, transferProgress, transferSpeed, receivedFile, peerDisconnected }) {
  
  // Initialize Room ID directly from URL param if invite link was used
  const [inputId, setInputId] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('room') || ''
  })
  const [joined, setJoined] = useState(false)

  function handleJoin() {
    if (!inputId.trim()) return
    setJoined(true)
    onJoin(inputId.trim().toUpperCase())
  }

  // Format bytes to human-readable size
  function formatSize(bytes) {
    if (!bytes) return ''
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / 1024 / 1024).toFixed(1) + ' MB'
  }

  return (
    <div className="w-full max-w-lg mx-auto">
      <h2 className="text-2xl font-bold text-violet-600 dark:text-violet-400 mb-6 text-center">
        Receive a File
      </h2>

      {/* Room ID input — shown before joining */}
      {!joined && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 space-y-4">
          <p className="text-gray-500 dark:text-gray-400 text-sm text-center">
            Enter the Room ID shared by the sender
          </p>
          <input
            type="text"
            value={inputId}
            onChange={(e) => setInputId(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            placeholder="e.g. A3F9KL"
            maxLength={6}
            className="w-full bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-center text-2xl font-mono tracking-widest rounded-xl py-4 px-4 border border-gray-200 dark:border-gray-600 focus:outline-none focus:border-violet-500 dark:focus:border-violet-400 transition"
          />
          <button
            onClick={handleJoin}
            className="w-full bg-violet-600 hover:bg-violet-700 text-white font-medium py-3 rounded-xl transition"
          >
            Join Room →
          </button>
        </div>
      )}

      {/* Transfer state — shown after joining */}
      {joined && (
        <div className="space-y-4">

          {/* Room ID display */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-gray-400 text-sm mb-1">Room ID</p>
            <p className="text-violet-600 dark:text-violet-300 font-mono text-2xl font-bold tracking-widest">
              {inputId}
            </p>
          </div>

          {/* Connection status badge */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-200 dark:border-gray-700">
            <StatusBadge status={connectionStatus} peerDisconnected={peerDisconnected} />
          </div>

          {/* Real-time transfer progress bar */}
          {transferProgress > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-200 dark:border-gray-700 space-y-2">
              <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
                <span>Receiving...</span>
                <span>{transferProgress}% · {transferSpeed} MB/s</span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3">
                <div
                  className="bg-green-500 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${transferProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Success card — shown when file is fully received and verified */}
          {receivedFile && (
            <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-700 rounded-2xl p-5 text-center space-y-1">
              <p className="text-green-600 dark:text-green-400 font-semibold text-lg">
                ✅ File received!
              </p>
              <p className="text-green-700 dark:text-green-300 text-sm font-medium">
                {receivedFile.name}
              </p>
              <p className="text-green-500 text-xs">
                {formatSize(receivedFile.size)} · SHA-256 verified ✓
              </p>
            </div>
          )}

          {/* Hash mismatch error — file corrupted during transfer */}
          {connectionStatus === 'hash-mismatch' && (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-700 rounded-2xl p-4 text-red-600 dark:text-red-300 text-sm text-center">
              ❌ File integrity check failed! The file may be corrupted. Please try again.
            </div>
          )}

          {/* Room not found error — with option to try a different ID */}
          {connectionStatus === 'room-not-found' && (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-700 rounded-2xl p-4 text-red-600 dark:text-red-300 text-sm text-center space-y-3">
              <p>❌ Room not found. Check the Room ID and try again.</p>
              <button
                onClick={() => window.location.reload()}
                className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition"
              >
                ← Try Again
              </button>
            </div>
          )}

          {/* Peer disconnected warning — with option to go back home */}
          {peerDisconnected && (
            <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-700 rounded-2xl p-4 text-yellow-600 dark:text-yellow-300 text-sm text-center space-y-3">
              <p>⚠️ Sender disconnected from the session.</p>
              <button
                onClick={() => window.location.reload()}
                className="bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition"
              >
                ← Back to Home
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// StatusBadge — colour-coded connection state indicator
function StatusBadge({ status, peerDisconnected }) {
  if (peerDisconnected) return (
    <p className="text-red-500 dark:text-red-400 text-sm font-medium">🔴 Peer disconnected</p>
  )

  const map = {
    idle:             ['🔵', 'text-blue-500 dark:text-blue-400',    'Idle'],
    connecting:       ['🟠', 'text-orange-500 dark:text-orange-400','Connecting to sender...'],
    connected:        ['🟢', 'text-green-500 dark:text-green-400',  'Connected — receiving file...'],
    done:             ['✅', 'text-green-500 dark:text-green-400',  'Transfer complete!'],
    'room-not-found': ['🔴', 'text-red-500 dark:text-red-400',      'Room not found'],
    failed:           ['🔴', 'text-red-500 dark:text-red-400',      'Connection failed'],
  }

  const [icon, color, label] = map[status] || ['🔵', 'text-gray-400', status]
  return <p className={`text-sm font-medium ${color}`}>{icon} {label}</p>
}