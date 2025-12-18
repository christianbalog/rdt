import { Wifi, WifiOff, Database, Activity } from 'lucide-react'
import useStore from '../store/useStore'

const SystemStatus = () => {
  const { wsConnected, cameras } = useStore()

  const onlineCameras = cameras.filter(c => c.status === 'online').length
  const totalCameras = cameras.length

  return (
    <div className="card">
      <h2 className="text-xl font-bold mb-4">État du système</h2>

      <div className="space-y-4">
        {/* Connexion WebSocket */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            {wsConnected ? (
              <Wifi className="text-green-600" size={24} />
            ) : (
              <WifiOff className="text-red-600" size={24} />
            )}
            <div>
              <p className="font-medium">Connexion temps réel</p>
              <p className="text-sm text-gray-600">
                {wsConnected ? 'Connecté' : 'Déconnecté'}
              </p>
            </div>
          </div>
          <span className={`badge ${wsConnected ? 'badge-success' : 'badge-danger'}`}>
            {wsConnected ? 'OK' : 'KO'}
          </span>
        </div>

        {/* Caméras */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            <Activity className="text-blue-600" size={24} />
            <div>
              <p className="font-medium">Caméras</p>
              <p className="text-sm text-gray-600">
                {onlineCameras} / {totalCameras} en ligne
              </p>
            </div>
          </div>
          <span className={`badge ${onlineCameras === totalCameras ? 'badge-success' : 'badge-warning'}`}>
            {onlineCameras}/{totalCameras}
          </span>
        </div>

        {/* Base de données */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            <Database className="text-purple-600" size={24} />
            <div>
              <p className="font-medium">Base de données</p>
              <p className="text-sm text-gray-600">Opérationnelle</p>
            </div>
          </div>
          <span className="badge badge-success">OK</span>
        </div>
      </div>
    </div>
  )
}

export default SystemStatus
