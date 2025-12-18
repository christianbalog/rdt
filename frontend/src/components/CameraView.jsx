import { useEffect, useRef, useState } from 'react'
import { Video, VideoOff, Maximize2, Camera } from 'lucide-react'
import Hls from 'hls.js'

const CameraView = ({ camera, showControls = true }) => {
  const videoRef = useRef(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!videoRef.current) return

    const streamUrl = `${import.meta.env.VITE_API_URL}/api/cameras/${camera.id}/stream.m3u8`

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
      })

      hls.loadSource(streamUrl)
      hls.attachMedia(videoRef.current)

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false)
        videoRef.current?.play()
      })

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          setError('Erreur de chargement du flux vidéo')
          setIsLoading(false)
        }
      })

      return () => {
        hls.destroy()
      }
    } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      // Support natif HLS (Safari)
      videoRef.current.src = streamUrl
      videoRef.current.addEventListener('loadedmetadata', () => {
        setIsLoading(false)
        videoRef.current?.play()
      })
    } else {
      setError('Votre navigateur ne supporte pas la lecture vidéo HLS')
      setIsLoading(false)
    }
  }, [camera.id])

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

  const takeSnapshot = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/cameras/${camera.id}/snapshot`)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `snapshot-${camera.id}-${Date.now()}.jpg`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Erreur lors de la capture:', err)
    }
  }

  const getStatusColor = () => {
    switch (camera.status) {
      case 'online': return 'bg-green-500'
      case 'offline': return 'bg-red-500'
      case 'recording': return 'bg-red-600 animate-pulse'
      default: return 'bg-gray-500'
    }
  }

  return (
    <div ref={containerRef} className="card relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${getStatusColor()}`}></div>
          <h3 className="font-semibold text-lg">{camera.name}</h3>
          <span className="text-sm text-gray-500">{camera.location}</span>
        </div>
        {showControls && (
          <div className="flex gap-2">
            <button
              onClick={takeSnapshot}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Prendre une capture"
            >
              <Camera size={20} />
            </button>
            <button
              onClick={handleFullscreen}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Plein écran"
            >
              <Maximize2 size={20} />
            </button>
          </div>
        )}
      </div>

      {/* Video Container */}
      <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <div className="text-white flex flex-col items-center gap-2">
              <Video className="animate-pulse" size={48} />
              <p>Chargement du flux...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <div className="text-white flex flex-col items-center gap-2">
              <VideoOff size={48} />
              <p>{error}</p>
            </div>
          </div>
        )}

        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          autoPlay
          muted
          playsInline
        />

        {/* Overlay pour le statut recording */}
        {camera.status === 'recording' && (
          <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
            REC
          </div>
        )}
      </div>

      {/* Footer avec informations */}
      <div className="mt-3 text-sm text-gray-600">
        <p>ID: {camera.id}</p>
      </div>
    </div>
  )
}

export default CameraView
