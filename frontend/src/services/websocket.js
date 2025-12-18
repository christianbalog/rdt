import { io } from 'socket.io-client'

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000'

class WebSocketService {
  constructor() {
    this.socket = null
    this.listeners = new Map()
  }

  connect(onConnect, onDisconnect) {
    if (this.socket?.connected) {
      return
    }

    this.socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    })

    this.socket.on('connect', () => {
      console.log('WebSocket connected')
      onConnect?.()
    })

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected')
      onDisconnect?.()
    })

    this.socket.on('error', (error) => {
      console.error('WebSocket error:', error)
    })

    // Événements du système
    this.socket.on('event', (data) => {
      this.emit('event', data)
    })

    this.socket.on('alert', (data) => {
      this.emit('alert', data)
    })

    this.socket.on('camera_status', (data) => {
      this.emit('camera_status', data)
    })

    this.socket.on('motion_detected', (data) => {
      this.emit('motion_detected', data)
    })

    this.socket.on('button_pressed', (data) => {
      this.emit('button_pressed', data)
    })
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    this.listeners.clear()
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event).push(callback)

    // Retourne une fonction pour se désabonner
    return () => this.off(event, callback)
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return

    const callbacks = this.listeners.get(event)
    const index = callbacks.indexOf(callback)
    if (index > -1) {
      callbacks.splice(index, 1)
    }
  }

  emit(event, data) {
    if (!this.listeners.has(event)) return

    this.listeners.get(event).forEach(callback => {
      try {
        callback(data)
      } catch (error) {
        console.error(`Error in WebSocket listener for ${event}:`, error)
      }
    })
  }

  send(event, data) {
    if (this.socket?.connected) {
      this.socket.emit(event, data)
    }
  }
}

export default new WebSocketService()
