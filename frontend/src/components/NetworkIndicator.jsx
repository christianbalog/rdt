import { Wifi, WifiOff, Activity, AlertTriangle } from 'lucide-react'
import useNetworkStore from '../store/useNetworkStore'

const NetworkIndicator = ({ detailed = false }) => {
  const { isOnline, connectionQuality, stats } = useNetworkStore()

  const getStatusIcon = () => {
    if (!isOnline) return <WifiOff className="text-red-500" size={20} />

    switch (connectionQuality) {
      case 'good':
        return <Wifi className="text-green-500" size={20} />
      case 'fair':
        return <Wifi className="text-yellow-500" size={20} />
      case 'poor':
        return <AlertTriangle className="text-orange-500" size={20} />
      default:
        return <Activity className="text-gray-500" size={20} />
    }
  }

  const getStatusText = () => {
    if (!isOnline) return 'Hors ligne'

    switch (connectionQuality) {
      case 'good':
        return 'Excellent'
      case 'fair':
        return 'Moyen'
      case 'poor':
        return 'Faible'
      default:
        return 'Inconnu'
    }
  }

  const getStatusColor = () => {
    if (!isOnline) return 'bg-red-100 text-red-800 border-red-300'

    switch (connectionQuality) {
      case 'good':
        return 'bg-green-100 text-green-800 border-green-300'
      case 'fair':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'poor':
        return 'bg-orange-100 text-orange-800 border-orange-300'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  if (!detailed) {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${getStatusColor()}`}>
        {getStatusIcon()}
        <span className="text-sm font-medium">{getStatusText()}</span>
        {stats.latency > 0 && (
          <span className="text-xs opacity-75">{stats.latency}ms</span>
        )}
      </div>
    )
  }

  return (
    <div className={`p-4 rounded-lg border ${getStatusColor()}`}>
      <div className="flex items-center gap-3 mb-3">
        {getStatusIcon()}
        <div>
          <h3 className="font-semibold">Connexion : {getStatusText()}</h3>
          {!isOnline && (
            <p className="text-sm opacity-75">Mode offline activé</p>
          )}
        </div>
      </div>

      {isOnline && (
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="opacity-75">Latence:</span>
            <span className="ml-2 font-medium">{stats.latency}ms</span>
          </div>
          <div>
            <span className="opacity-75">Reconnexions:</span>
            <span className="ml-2 font-medium">{stats.reconnectCount}</span>
          </div>
          {stats.jitter > 0 && (
            <>
              <div>
                <span className="opacity-75">Jitter:</span>
                <span className="ml-2 font-medium">{stats.jitter}ms</span>
              </div>
              <div>
                <span className="opacity-75">Perte:</span>
                <span className="ml-2 font-medium">{stats.packetLoss}%</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default NetworkIndicator
