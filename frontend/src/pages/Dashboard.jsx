import { useEffect } from 'react'
import CameraViewWebRTC from '../components/CameraViewWebRTC'
import ModeSelector from '../components/ModeSelector'
import AlertPanel from '../components/AlertPanel'
import useStore from '../store/useStore'
import websocket from '../services/websocket'
import { eventsAPI } from '../services/api'
import { Activity, Wifi, WifiOff } from 'lucide-react'

const Dashboard = () => {
  const {
    cameras,
    mode,
    events,
    setEvents,
    addEvent,
    addAlert,
    updateCameraStatus,
    setWsConnected,
    wsConnected,
  } = useStore()

  useEffect(() => {
    // Charger les événements initiaux
    loadEvents()

    // Connexion WebSocket
    websocket.connect(
      () => setWsConnected(true),
      () => setWsConnected(false)
    )

    // Écouter les événements en temps réel
    const unsubscribeEvent = websocket.on('event', (data) => {
      addEvent(data)
    })

    const unsubscribeMotion = websocket.on('motion_detected', (data) => {
      addEvent({
        id: Date.now(),
        type: 'motion_detected',
        device_id: data.device_id,
        timestamp: data.timestamp || new Date().toISOString(),
        details: data.details,
      })

      // Créer une alerte uniquement en mode surveillance
      const currentMode = useStore.getState().mode
      if (currentMode === 'surveillance') {
        addAlert({
          title: 'Mouvement détecté',
          message: `Mouvement détecté par ${data.device_id}`,
          device_id: data.device_id,
          type: 'motion',
        })
      }
    })

    const unsubscribeButton = websocket.on('button_pressed', (data) => {
      addEvent({
        id: Date.now(),
        type: 'button_pressed',
        device_id: data.device_id,
        timestamp: data.timestamp || new Date().toISOString(),
        details: data.details,
      })

      // Le capteur de tapis crée toujours une alerte (tous modes)
      addAlert({
        title: 'Alerte : Pression détectée',
        message: `Quelqu'un a marché sur le tapis (${data.device_id})`,
        device_id: data.device_id,
        type: 'button',
      })
    })

    const unsubscribeCameraStatus = websocket.on('camera_status', (data) => {
      updateCameraStatus(data.camera_id, data.status)
    })

    const unsubscribeAlert = websocket.on('alert', (data) => {
      addAlert(data)
    })

    // Cleanup
    return () => {
      unsubscribeEvent()
      unsubscribeMotion()
      unsubscribeButton()
      unsubscribeCameraStatus()
      unsubscribeAlert()
    }
  }, [])

  const loadEvents = async () => {
    try {
      const response = await eventsAPI.getRecent(50)
      setEvents(response.data)
    } catch (error) {
      console.error('Erreur lors du chargement des événements:', error)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200">
      <AlertPanel />

      {/* Header épuré */}
      <header className="bg-white/80 backdrop-blur-md shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Activity size={28} className="text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">
                Surveillance
              </h1>
            </div>

            {/* Indicateur de connexion */}
            <div className="flex items-center gap-2">
              {wsConnected ? (
                <>
                  <Wifi size={20} className="text-green-500" />
                  <span className="text-sm text-green-600 font-medium">Connecté</span>
                </>
              ) : (
                <>
                  <WifiOff size={20} className="text-red-500" />
                  <span className="text-sm text-red-600 font-medium">Déconnecté</span>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Contenu principal style Home Assistant */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Caméras - 2 colonnes sur grand écran */}
          <div className="lg:col-span-2">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {cameras.map((camera) => (
                <div key={camera.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <CameraViewWebRTC camera={camera} />
                </div>
              ))}
            </div>
          </div>

          {/* Sélecteur de mode - 1 colonne */}
          <div className="space-y-6">
            <ModeSelector />

            {/* Activité récente */}
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <h2 className="text-lg font-semibold mb-3">Activité récente</h2>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {events.slice(0, 8).map((event, idx) => (
                  <div
                    key={event.id || idx}
                    className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {event.type === 'motion_detected' && 'Mouvement détecté'}
                        {event.type === 'button_pressed' && 'Pression sur tapis'}
                        {!['motion_detected', 'button_pressed'].includes(event.type) && event.type}
                      </p>
                      <p className="text-xs text-gray-500">
                        {event.device_id} • {new Date(event.timestamp).toLocaleTimeString('fr-FR')}
                      </p>
                    </div>
                  </div>
                ))}
                {events.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">
                    Aucun événement récent
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default Dashboard
