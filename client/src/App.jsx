import { useEffect, useState } from 'react'
import { useWebRTC } from './hooks/useWebRTC'
import Sender from './components/Sender'
import Receiver from './components/Receiver'

export default function App() {
  // ✅ Fix 1: Read URL param directly in useState initializer — no useEffect needed
  const [mode, setMode] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('room') ? 'receiver' : null
  })

  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('theme') !== 'light'
  })

  const {
    roomId, connectionStatus, transferProgress,
    transferSpeed, receivedFile, peerDisconnected,
    createRoom, joinRoom,
  } = useWebRTC()

  // ✅ Fix 2: This useEffect is fine — it syncs with external systems (DOM + localStorage)
  useEffect(() => {
    const root = document.documentElement
    if (darkMode) {
      root.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      root.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [darkMode])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white transition-colors duration-300 flex flex-col">

      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex items-center justify-between backdrop-blur bg-white/80 dark:bg-gray-950/80 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          {/* Show back button when in sender/receiver mode */}
          {mode && (
            <button
              onClick={() => window.location.reload()}
              className="text-gray-400 hover:text-violet-500 transition text-sm mr-2"
              title="Back to home"
            >
              ←
            </button>
          )}
          <span className="text-2xl">⚡</span>
          <span className="text-xl font-bold text-violet-600 dark:text-violet-400 tracking-tight">P2P WebShare</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-400 dark:text-gray-500 font-mono hidden sm:block">
            Direct · Encrypted · No Server Storage
          </span>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200 text-lg"
            title="Toggle theme"
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center p-6">

        {/* Home screen */}
        {!mode && (
          <div className="text-center space-y-8 max-w-lg w-full">

            {/* Hero */}
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-300 text-xs font-medium px-3 py-1 rounded-full border border-violet-200 dark:border-violet-800">
                🔒 End-to-end · SHA-256 verified · Zero server storage
              </div>
              <h1 className="text-5xl font-extrabold text-gray-900 dark:text-white leading-tight">
                Share files<br />
                <span className="text-violet-600 dark:text-violet-400">instantly</span>
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-lg">
                Browser-to-browser. No uploads. No cloud.<br />Just direct P2P transfer.
              </p>
            </div>

            {/* Action cards */}
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setMode('sender')}
                className="group bg-violet-600 hover:bg-violet-700 text-white rounded-2xl p-6 flex flex-col items-center gap-3 transition-all duration-200 hover:scale-105 hover:shadow-xl hover:shadow-violet-500/20"
              >
                <span className="text-5xl group-hover:scale-110 transition-transform duration-200">📤</span>
                <span className="font-bold text-xl">Send</span>
                <span className="text-violet-200 text-xs">Drop a file, get a link</span>
              </button>

              <button
                onClick={() => setMode('receiver')}
                className="group bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-2xl p-6 flex flex-col items-center gap-3 transition-all duration-200 hover:scale-105 hover:shadow-xl border border-gray-200 dark:border-gray-700"
              >
                <span className="text-5xl group-hover:scale-110 transition-transform duration-200">📥</span>
                <span className="font-bold text-xl">Receive</span>
                <span className="text-gray-400 text-xs">Enter a Room ID</span>
              </button>
            </div>

            {/* How it works */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-200 dark:border-gray-800 text-left space-y-3">
              <p className="text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider">How it works</p>
              <div className="space-y-3">
                {[
                  ['📤', 'Sender drops a file → gets a unique Room ID'],
                  ['🔗', 'Share the Room ID or invite link with receiver'],
                  ['📥', 'Receiver enters Room ID → direct connection opens'],
                  ['🔒', 'File streams P2P · SHA-256 verified on arrival'],
                ].map(([icon, text]) => (
                  <div key={text} className="flex items-start gap-3">
                    <span className="text-lg">{icon}</span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">{text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats bar */}
            <div className="grid grid-cols-3 gap-3">
              {[
                ['0 KB', 'Server storage'],
                ['16 KB', 'Chunk size'],
                ['SHA-256', 'Integrity check'],
              ].map(([val, label]) => (
                <div key={label} className="bg-white dark:bg-gray-900 rounded-xl p-3 border border-gray-200 dark:border-gray-800 text-center">
                  <p className="text-violet-600 dark:text-violet-400 font-bold text-sm">{val}</p>
                  <p className="text-gray-400 text-xs mt-0.5">{label}</p>
                </div>
              ))}
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

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 px-6 py-4 flex items-center justify-between">
        {mode ? (
          <button
            onClick={() => window.location.reload()}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-sm transition"
          >
            ← Back to home
          </button>
        ) : (
          <span className="text-gray-400 text-xs">P2P WebShare · Built with WebRTC</span>
        )}
        <span className="text-gray-400 text-xs">MARS Open Projects 2026</span>
      </footer>
    </div>
  )
}