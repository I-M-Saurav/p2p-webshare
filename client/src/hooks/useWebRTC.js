import { useRef, useState, useCallback } from 'react'
import { socket } from '../socket'

const CHUNK_SIZE = 16384

export function useWebRTC() {
  const [role, setRole] = useState(null)
  const [roomId, setRoomId] = useState(null)
  const [connectionStatus, setConnectionStatus] = useState('idle')
  const [transferProgress, setTransferProgress] = useState(0)
  const [transferSpeed, setTransferSpeed] = useState(0)
  const [receivedFile, setReceivedFile] = useState(null)
  const [peerDisconnected, setPeerDisconnected] = useState(false)

  const pcRef = useRef(null)
  const dataChannelRef = useRef(null)
  const fileRef = useRef(null)
  const receivedChunksRef = useRef([])
  const receivedSizeRef = useRef(0)
  const filemetaRef = useRef(null)
  const lastTimeRef = useRef(null)
  const lastBytesRef = useRef(0)

  // --- Define these FIRST before they are used ---

  function setupDataChannelSender(dc, file) {
    dc.onopen = async () => {
      setConnectionStatus('connected')
      const meta = JSON.stringify({ name: file.name, size: file.size, type: file.type })
      dc.send(meta)

      const arrayBuffer = await file.arrayBuffer()
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
      dc.send(JSON.stringify({ hash: hashHex }))

      let offset = 0
      lastTimeRef.current = Date.now()
      lastBytesRef.current = 0

      function sendChunk() {
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
          setTransferProgress(Math.round((offset / file.size) * 100))

          const now = Date.now()
          const elapsed = (now - lastTimeRef.current) / 1000
          if (elapsed > 0.5) {
            const bytesSince = offset - lastBytesRef.current
            setTransferSpeed((bytesSince / elapsed / 1024 / 1024).toFixed(2))
            lastTimeRef.current = now
            lastBytesRef.current = offset
          }

          if (dc.bufferedAmount < CHUNK_SIZE * 8) {
            sendChunk()
          } else {
            dc.bufferedAmountLowThreshold = CHUNK_SIZE * 4
            dc.onbufferedamountlow = () => { dc.onbufferedamountlow = null; sendChunk() }
          }
        }
        reader.readAsArrayBuffer(slice)
      }
      sendChunk()
    }
  }

  function setupDataChannelReceiver(dc) {
    let fileHash = null
    lastTimeRef.current = Date.now()

    dc.onopen = () => {
      setConnectionStatus('connected')
      lastTimeRef.current = Date.now()
    }

    dc.onmessage = async (e) => {
      if (typeof e.data === 'string') {
        const msg = JSON.parse(e.data)
        if (msg.name) { filemetaRef.current = msg; return }
        if (msg.hash) { fileHash = msg.hash; return }
        if (msg.done) {
          const blob = new Blob(receivedChunksRef.current, { type: filemetaRef.current.type })
          const arrayBuffer = await blob.arrayBuffer()
          const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
          const hashArray = Array.from(new Uint8Array(hashBuffer))
          const receivedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

          if (receivedHash !== fileHash) {
            setConnectionStatus('hash-mismatch')
            return
          }

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

      receivedChunksRef.current.push(e.data)
      receivedSizeRef.current += e.data.byteLength
      setTransferProgress(Math.round((receivedSizeRef.current / filemetaRef.current.size) * 100))

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

  // --- Now define the callbacks that use the above functions ---

  const createPeerConnection = useCallback((roomId) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    })
    pc.onicecandidate = (e) => {
      if (e.candidate) socket.emit('ice-candidate', { roomId, candidate: e.candidate })
    }
    pc.onconnectionstatechange = () => {
      setConnectionStatus(pc.connectionState)
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setPeerDisconnected(true)
      }
    }
    pcRef.current = pc
    return pc
  }, [])

  const createRoom = useCallback((file) => {
    const id = Math.random().toString(36).substring(2, 8).toUpperCase()
    fileRef.current = file
    setRoomId(id)
    setRole('sender')
    setConnectionStatus('waiting')

    socket.emit('create-room', id)

    socket.on('receiver-joined', async () => {
      setConnectionStatus('connecting')
      const pc = createPeerConnection(id)
      const dc = pc.createDataChannel('file-transfer')
      dataChannelRef.current = dc
      setupDataChannelSender(dc, file)

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      socket.emit('offer', { roomId: id, offer })
    })

    socket.on('answer', async (answer) => {
      await pcRef.current.setRemoteDescription(answer)
    })

    socket.on('ice-candidate', async (candidate) => {
      await pcRef.current.addIceCandidate(candidate)
    })

    socket.on('peer-disconnected', () => setPeerDisconnected(true))

    return id
  }, [createPeerConnection])

  const joinRoom = useCallback((id) => {
    setRoomId(id)
    setRole('receiver')
    setConnectionStatus('connecting')

    socket.emit('join-room', id)

    socket.on('room-not-found', () => setConnectionStatus('room-not-found'))

    socket.on('offer', async (offer) => {
      const pc = createPeerConnection(id)
      pc.ondatachannel = (e) => {
        dataChannelRef.current = e.channel
        setupDataChannelReceiver(e.channel)
      }
      await pc.setRemoteDescription(offer)
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      socket.emit('answer', { roomId: id, answer })
    })

    socket.on('ice-candidate', async (candidate) => {
      await pcRef.current.addIceCandidate(candidate)
    })

    socket.on('peer-disconnected', () => setPeerDisconnected(true))
  }, [createPeerConnection])

  return {
    role, roomId, connectionStatus, transferProgress,
    transferSpeed, receivedFile, peerDisconnected,
    createRoom, joinRoom
  }
}