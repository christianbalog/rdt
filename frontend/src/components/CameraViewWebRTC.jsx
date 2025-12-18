import { useEffect, useRef, useState } from 'react'
import { Video, VideoOff, Maximize2, Camera, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'

const CameraViewWebRTC = ({ camera, showControls = true }) => {
  const videoRef = useRef(null)
  const pcRef = useRef(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const containerRef = useRef(null)

  // URL du serveur MediaMTX (depuis .env)
  const MEDIAMTX_URL = import.meta.env.VITE_MEDIAMTX_URL || 'http://localhost:8889'

  useEffect(() => {
    startWebRTC()

    return () => {
      cleanup()
    }
  }, [camera.id])

  const startWebRTC = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Créer la connexion WebRTC
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      })

      pcRef.current = pc

      // Gérer les tracks reçus
      pc.ontrack = (event) => {
        console.log('Track reçu:', event.track.kind)
        if (videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0]
          setIsLoading(false)
          setIsConnected(true)
        }
      }

      // Gérer l'état de la connexion
      pc.onconnectionstatechange = () => {
        console.log('Connection state:', pc.connectionState)
        if (pc.connectionState === 'connected') {
          setIsConnected(true)
          setIsLoading(false)
        } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          setIsConnected(false)
          setError('Connexion perdue. Tentative de reconnexion...')
          // Retry après 3 secondes
          setTimeout(() => {
            cleanup()
            startWebRTC()
          }, 3000)
        }
      }

      // Ajouter un transceiver pour recevoir la vidéo
      pc.addTransceiver('video', { direction: 'recvonly' })
      pc.addTransceiver('audio', { direction: 'recvonly' })

      // Créer l'offre SDP
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      // Envoyer l'offre au serveur MediaMTX via WHEP
      const whepUrl = `${MEDIAMTX_URL}/${camera.id}/whep`

      const response = await fetch(whepUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/sdp',
        },
        body: offer.sdp,
      })

      if (!response.ok) {
        throw new Error(`Erreur WHEP: ${response.status} ${response.statusText}`)
      }

      // Récupérer la réponse SDP du serveur
      const answerSdp = await response.text()
      await pc.setRemoteDescription(
        new RTCSessionDescription({
          type: 'answer',
          sdp: answerSdp,
        })
      )

      console.log('WebRTC connecté avec succès')
    } catch (err) {
      console.error('Erreur WebRTC:', err)
      setError(`Erreur de connexion: ${err.message}`)
      setIsLoading(false)
    }
  }

  const cleanup = () => {
    if (pcRef.current) {
      pcRef.current.close()
      pcRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsConnected(false)
  }

  const handleFullscreen = () => {
    if (!containerRef.current) return

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  const takeSnapshot = () => {
    if (!videoRef.current) return

    const canvas = document.createElement('canvas')
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(videoRef.current, 0, 0)

    canvas.toBlob((blob) => {
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `snapshot-${camera.id}-${Date.now()}.jpg`
      a.click()
      window.URL.revokeObjectURL(url)
    }, 'image/jpeg')
  }

  const handleReconnect = () => {
    cleanup()
    startWebRTC()
  }

  const handleServoControl = async (direction) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/cameras/${camera.id}/servo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ direction }),
      })

      if (!response.ok) {
        console.error('Erreur lors du contrôle du servomoteur')
      }
    } catch (error) {
      console.error('Erreur lors de l\'envoi de la commande servo:', error)
    }
  }

  const getStatusColor = () => {
    if (isConnected && camera.status === 'recording') return 'bg-red-600 animate-pulse'
    if (isConnected) return 'bg-green-500'
    return 'bg-red-500'
  }

  const getStatusText = () => {
    if (isConnected && camera.status === 'recording') return 'Enregistrement'
    if (isConnected) return 'En ligne'
    return 'Hors ligne'
  }

  return (
    <div ref={containerRef} className="relative p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor()}`}></div>
          <h3 className="font-semibold text-base">{camera.name}</h3>
          <span className="text-sm text-gray-400">• {camera.location}</span>
        </div>
        {showControls && (
          <div className="flex gap-1">
            <button
              onClick={handleReconnect}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              title="Reconnecter"
              disabled={isLoading}
            >
              <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={takeSnapshot}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              title="Prendre une capture"
              disabled={!isConnected}
            >
              <Camera size={18} />
            </button>
            <button
              onClick={handleFullscreen}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Plein écran"
            >
              <Maximize2 size={18} />
            </button>
          </div>
        )}
      </div>

      {/* Video Container */}
      <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
            <div className="text-white flex flex-col items-center gap-2">
              <Video className="animate-pulse" size={48} />
              <p>Connexion WebRTC...</p>
              <p className="text-xs text-gray-400">{camera.id}</p>
            </div>
          </div>
        )}

        {error && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
            <div className="text-white flex flex-col items-center gap-3 p-4 text-center">
              <VideoOff size={48} />
              <p className="text-sm">{error}</p>
              <button
                onClick={handleReconnect}
                className="btn-primary text-sm"
              >
                Réessayer
              </button>
            </div>
          </div>
        )}

        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          autoPlay
          playsInline
          muted
        />

        {/* Overlay pour le statut recording */}
        {isConnected && camera.status === 'recording' && (
          <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 z-20">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
            REC
          </div>
        )}

        {/* Indicateur WebRTC */}
        {isConnected && (
          <div className="absolute bottom-4 left-4 bg-black bg-opacity-60 text-white px-2 py-1 rounded text-xs z-20">
            WebRTC • Temps réel
          </div>
        )}
      </div>

      {/* Contrôles du servomoteur */}
      {showControls && (
        <div className="mt-3 flex items-center justify-center gap-3">
          <button
            onClick={() => handleServoControl('left')}
            disabled={!isConnected}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Tourner à gauche"
          >
            <ChevronLeft size={20} />
            <span className="text-sm font-medium">Gauche</span>
          </button>

          <div className="px-3 py-2 bg-gray-100 rounded-lg">
            <span className="text-xs text-gray-600 font-medium">Servomoteur</span>
          </div>

          <button
            onClick={() => handleServoControl('right')}
            disabled={!isConnected}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Tourner à droite"
          >
            <span className="text-sm font-medium">Droite</span>
            <ChevronRight size={20} />
          </button>
        </div>
      )}

    </div>
  )
}

export default CameraViewWebRTC
