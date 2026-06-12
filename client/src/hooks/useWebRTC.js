import { useRef, useState, useCallback } from 'react'
import { socket } from '../socket'

// Chunk size for splitting files during transfer (16KB is optimal for WebRTC data channels)
const CHUNK_SIZE = 16384

// useWebRTC — core hook that manages the entire WebRTC lifecycle:
// room creation, signaling, P2P connection, file chunking, SHA-256 verification
export function useWebRTC() {
  const [role, setRole] = useState(null)              // 'sender' | 'receiver'
  const [roomId, setRoomId] = useState(null)          // current room ID
  const [connectionStatus, setConnectionStatus] = useState('idle') // connection state
  const [transferProgress, setTransferProgress] = useState(0)      // 0-100
  const [transferSpeed, setTransferSpeed] = useState(0)            // MB/s
  const [receivedFile, setReceivedFile] = useState(null)           // file metadata on receipt
  const [peerDisconnected, setPeerDisconnected] = useState(false)  // true if peer dropped

  // Refs persist across renders without causing re-renders
  const pcRef = useRef(null)               // RTCPeerConnection instance
  const dataChannelRef = useRef(null)      // WebRTC DataChannel instance
  const fileRef = useRef(null)             // file selected by sender
  const receivedChunksRef = useRef([])     // array of received ArrayBuffer chunks
  const receivedSizeRef = useRef(0)        // total bytes received so far
  const filemetaRef = useRef(null)         // file metadata sent ahead of binary data
  const lastTimeRef = useRef(null)         // timestamp for speed calculation
  const lastBytesRef = useRef(0)           // byte count at last speed sample

  // --- DATA CHANNEL SETUP (SENDER SIDE) ---
  // Called once the data channel opens; sends metadata, hash, then file chunks
  function setupDataChannelSender(dc, file) {
    dc.onopen = async () => {
      setConnectionStatus('connected')

      // Step 1: Send file metadata so receiver knows filename, size, type
      const meta = JSON.stringify({ name: file.name, size: file.size, type: file.type })
      dc.send(meta)

      // Step 2: Compute SHA-256 hash of the full file for integrity verification
      const arrayBuffer = await file.arrayBuffer()
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
      dc.send(JSON.stringify({ hash: hashHex }))

      // Step 3: Send file in 16KB chunks
      let offset = 0
      lastTimeRef.current = Date.now()
      lastBytesRef.current = 0

      function sendChunk() {
        // All chunks sent — signal completion
        if (offset >= file.size) {
          dc.send(JSON.stringify({ done: true }))
          setTransferProgress(100)
          return
        }

        const slice = file.slice(offset, offset + CHUNK_SIZE)
        const reader = new FileReader()
        reader.onload = (e) => {
          dc.send(e.target.result)
          offset += e.target.result.byteLength

          // Update progress percentage
          setTransferProgress(Math.round((offset / file.size) * 100))

          // Calculate transfer speed every 0.5s
          const now = Date.now()
          const elapsed = (now - lastTimeRef.current) / 1000
          if (elapsed > 0.5) {
            const bytesSince = offset - lastBytesRef.current
            setTransferSpeed((bytesSince / elapsed / 1024 / 1024).toFixed(2))
            lastTimeRef.current = now
            lastBytesRef.current = offset
          }

          // Flow control: wait for buffer to drain before sending more
          if (dc.bufferedAmount < CHUNK_SIZE * 8) {
            sendChunk()
          } else {
            dc.bufferedAmountLowThreshold = CHUNK_SIZE * 4
            dc.onbufferedamountlow = () => {
              dc.onbufferedamountlow = null
              sendChunk()
            }
          }
        }
        reader.readAsArrayBuffer(slice)
      }
      sendChunk()
    }
  }

  // --- DATA CHANNEL SETUP (RECEIVER SIDE) ---
  // Receives metadata, hash, binary chunks; reassembles and verifies file
  function setupDataChannelReceiver(dc) {
    let fileHash = null
    lastTimeRef.current = Date.now()

    dc.onopen = () => {
      setConnectionStatus('connected')
      lastTimeRef.current = Date.now()
    }

    dc.onmessage = async (e) => {
      // String messages carry control signals (metadata, hash, done)
      if (typeof e.data === 'string') {
        const msg = JSON.parse(e.data)

        // File metadata received first
        if (msg.name) {
          filemetaRef.current = msg
          return
        }

        // SHA-256 hash from sender — store for later verification
        if (msg.hash) {
          fileHash = msg.hash
          return
        }

        // Transfer complete — reassemble, verify, and trigger download
        if (msg.done) {
          const blob = new Blob(receivedChunksRef.current, { type: filemetaRef.current.type })

          // Verify integrity: compute hash of received data and compare to sender's hash
          const arrayBuffer = await blob.arrayBuffer()
          const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
          const hashArray = Array.from(new Uint8Array(hashBuffer))
          const receivedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

          if (receivedHash !== fileHash) {
            // Hash mismatch — file is corrupted, do not download
            setConnectionStatus('hash-mismatch')
            return
          }

          // Hash matches — trigger automatic file download in browser
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = filemetaRef.current.name
          a.click()
          URL.revokeObjectURL(url)

          setReceivedFile(filemetaRef.current)
          setTransferProgress(100)
          setConnectionStatus('done')
          return
        }
      }

      // Binary chunk — accumulate into chunks array
      receivedChunksRef.current.push(e.data)
      receivedSizeRef.current += e.data.byteLength

      // Update progress
      setTransferProgress(Math.round((receivedSizeRef.current / filemetaRef.current.size) * 100))

      // Calculate receive speed every 0.5s
      const now = Date.now()
      const elapsed = (now - lastTimeRef.current) / 1000
      if (elapsed > 0.5) {
        const bytesSince = receivedSizeRef.current - lastBytesRef.current
        setTransferSpeed((bytesSince / elapsed / 1024 / 1024).toFixed(2))
        lastTimeRef.current = now
        lastBytesRef.current = receivedSizeRef.current
      }
    }
  }

  // --- PEER CONNECTION FACTORY ---
  // Creates and configures an RTCPeerConnection with Google STUN server
  const createPeerConnection = useCallback((roomId) => {
    const pc = new RTCPeerConnection({
      // STUN server helps peers discover their public IP for NAT traversal
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    })

    // Send ICE candidates to the other peer via signaling server
    pc.onicecandidate = (e) => {
      if (e.candidate) socket.emit('ice-candidate', { roomId, candidate: e.candidate })
    }

    // Track connection state changes for UI updates
    pc.onconnectionstatechange = () => {
      setConnectionStatus(pc.connectionState)
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setPeerDisconnected(true)
      }
    }

    pcRef.current = pc
    return pc
  }, [])

  // --- SENDER: CREATE ROOM ---
  // Generates a unique room ID, registers it on the signaling server,
  // then waits for a receiver to join before starting WebRTC handshake
  const createRoom = useCallback((file) => {
    const id = Math.random().toString(36).substring(2, 8).toUpperCase()
    fileRef.current = file
    setRoomId(id)
    setRole('sender')
    setConnectionStatus('waiting')

    socket.emit('create-room', id)

    // Receiver has joined — initiate WebRTC offer
    socket.on('receiver-joined', async () => {
      setConnectionStatus('connecting')
      const pc = createPeerConnection(id)

      // Sender creates the data channel
      const dc = pc.createDataChannel('file-transfer')
      dataChannelRef.current = dc
      setupDataChannelSender(dc, file)

      // Create and send SDP offer to receiver via signaling server
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      socket.emit('offer', { roomId: id, offer })
    })

    // Receive SDP answer from receiver
    socket.on('answer', async (answer) => {
      await pcRef.current.setRemoteDescription(answer)
    })

    // Receive ICE candidates from receiver
    socket.on('ice-candidate', async (candidate) => {
      await pcRef.current.addIceCandidate(candidate)
    })

    // Handle receiver disconnecting
    socket.on('peer-disconnected', () => setPeerDisconnected(true))

    return id
  }, [createPeerConnection])

  // --- RECEIVER: JOIN ROOM ---
  // Joins an existing room by ID, receives the WebRTC offer,
  // creates an answer, and sets up the data channel for receiving
  const joinRoom = useCallback((id) => {
    setRoomId(id)
    setRole('receiver')
    setConnectionStatus('connecting')

    socket.emit('join-room', id)

    // Room doesn't exist on the server
    socket.on('room-not-found', () => setConnectionStatus('room-not-found'))

    // Receive SDP offer from sender
    socket.on('offer', async (offer) => {
      const pc = createPeerConnection(id)

      // Receiver listens for the data channel opened by sender
      pc.ondatachannel = (e) => {
        dataChannelRef.current = e.channel
        setupDataChannelReceiver(e.channel)
      }

      // Create and send SDP answer back to sender
      await pc.setRemoteDescription(offer)
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      socket.emit('answer', { roomId: id, answer })
    })

    // Receive ICE candidates from sender
    socket.on('ice-candidate', async (candidate) => {
      await pcRef.current.addIceCandidate(candidate)
    })

    // Handle sender disconnecting
    socket.on('peer-disconnected', () => setPeerDisconnected(true))
  }, [createPeerConnection])

  return {
    role, roomId, connectionStatus, transferProgress,
    transferSpeed, receivedFile, peerDisconnected,
    createRoom, joinRoom
  }
}