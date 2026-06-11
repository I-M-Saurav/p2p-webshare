import { useState, useRef } from 'react'

// Sender component — handles file selection and displays room ID + transfer progress
export default function Sender({ onFileSelect, roomId, connectionStatus, transferProgress, transferSpeed, peerDisconnected }) {
  const [dragOver, setDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const inputRef = useRef(null)

  // Handle file picked via drag-drop or file picker
  function handleFile(file) {
    if (!file) return
    // Enforce 50MB limit as per project requirements
    if (file.size > 50 * 1024 * 1024) {
      alert('File too large! Maximum size is 50MB.')
      return
    }
    setSelectedFile(file)
    onFileSelect(file)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    handleFile(e.dataTransfer.files[0])
  }

  // Format bytes to human-readable size
  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / 1024 / 1024).toFixed(1) + ' MB'
  }

  // Copy room link to clipboard
  function copyLink() {
    const link = `${window.location.origin}?room=${roomId}`
    navigator.clipboard.writeText(link)
    alert('Link copied to clipboard!')
  }

  return (
    <div className="w-full max-w-lg mx-auto">
      <h2 className="text-2xl font-bold text-violet-400 mb-6 text-center">Send a File</h2>

      {/* Drag and drop zone */}
      {!selectedFile && (
        <div
          onClick={() => inputRef.current.click()}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200
            ${dragOver ? 'border-violet-400 bg-violet-950' : 'border-gray-600 hover:border-violet-500 hover:bg-gray-900'}`}
        >
          <div className="text-5xl mb-4">📁</div>
          <p className="text-gray-300 text-lg font-medium">Drag & drop a file here</p>
          <p className="text-gray-500 text-sm mt-2">or click to browse</p>
          <p className="text-gray-600 text-xs mt-3">Max size: 50MB</p>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(e) => handleFile(e.target.files[0])}
          />
        </div>
      )}

      {/* File selected — show room info */}
      {selectedFile && (
        <div className="space-y-4">
          {/* File info card */}
          <div className="bg-gray-900 rounded-2xl p-4 flex items-center gap-4 border border-gray-700">
            <div className="text-3xl">📄</div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium truncate">{selectedFile.name}</p>
              <p className="text-gray-400 text-sm">{formatSize(selectedFile.size)}</p>
            </div>
          </div>

          {/* Room ID + share link */}
          {roomId && (
            <div className="bg-gray-900 rounded-2xl p-4 border border-gray-700 space-y-3">
              <p className="text-gray-400 text-sm">Share this Room ID with the receiver:</p>
              <div className="flex items-center gap-2">
                <span className="text-3xl font-mono font-bold text-violet-300 tracking-widest flex-1 text-center bg-gray-800 rounded-xl py-3">
                  {roomId}
                </span>
              </div>
              <button
                onClick={copyLink}
                className="w-full bg-violet-600 hover:bg-violet-700 text-white font-medium py-2 rounded-xl transition"
              >
                📋 Copy Invite Link
              </button>
            </div>
          )}

          {/* Connection status */}
          <div className="bg-gray-900 rounded-2xl p-4 border border-gray-700">
            <StatusBadge status={connectionStatus} peerDisconnected={peerDisconnected} />
          </div>

          {/* Transfer progress */}
          {(connectionStatus === 'connected' || transferProgress > 0) && (
            <div className="bg-gray-900 rounded-2xl p-4 border border-gray-700 space-y-2">
              <div className="flex justify-between text-sm text-gray-400">
                <span>Transfer Progress</span>
                <span>{transferProgress}% · {transferSpeed} MB/s</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-3">
                <div
                  className="bg-violet-500 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${transferProgress}%` }}
                />
              </div>
              {transferProgress === 100 && (
                <p className="text-green-400 text-sm text-center font-medium">✅ Transfer complete!</p>
              )}
            </div>
          )}

          {/* Peer disconnected warning */}
          {peerDisconnected && (
            <div className="bg-red-950 border border-red-700 rounded-2xl p-4 text-red-300 text-sm text-center">
              ⚠️ Receiver disconnected from the session.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Reusable status badge component
function StatusBadge({ status, peerDisconnected }) {
  if (peerDisconnected) return <p className="text-red-400 text-sm">🔴 Peer disconnected</p>

  const map = {
    idle: ['🔵', 'text-blue-400', 'Idle'],
    waiting: ['🟡', 'text-yellow-400', 'Waiting for receiver to join...'],
    connecting: ['🟠', 'text-orange-400', 'Establishing P2P connection...'],
    connected: ['🟢', 'text-green-400', 'Connected — transferring...'],
    done: ['✅', 'text-green-400', 'Transfer complete!'],
    failed: ['🔴', 'text-red-400', 'Connection failed'],
  }

  const [icon, color, label] = map[status] || ['🔵', 'text-gray-400', status]
  return <p className={`text-sm font-medium ${color}`}>{icon} {label}</p>
}