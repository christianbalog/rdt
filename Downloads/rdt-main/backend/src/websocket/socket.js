let ioInstance = null

export const initWebSocket = (io) => {
  ioInstance = io

  io.on('connection', (socket) => {
    console.log(`✅ Client WebSocket connecté: ${socket.id}`)

    socket.on('disconnect', () => {
      console.log(`❌ Client WebSocket déconnecté: ${socket.id}`)
    })

    // Événement de ping pour garder la connexion active
    socket.on('ping', () => {
      socket.emit('pong')
    })
  })
}

export const getIO = () => {
  if (!ioInstance) {
    throw new Error('Socket.IO n\'a pas été initialisé')
  }
  return ioInstance
}

// Fonctions utilitaires pour émettre des événements
export const emitEvent = (eventName, data) => {
  if (ioInstance) {
    ioInstance.emit(eventName, data)
    console.log(`📤 Événement émis: ${eventName}`, data)
  }
}

export const emitCameraStatus = (cameraId, status) => {
  emitEvent('camera_status', { camera_id: cameraId, status })
}

export const emitMotionDetected = (data) => {
  emitEvent('motion_detected', data)
}

export const emitButtonPressed = (data) => {
  emitEvent('button_pressed', data)
}

export const emitAlert = (data) => {
  emitEvent('alert', data)
}
