import { X, Check, AlertTriangle } from 'lucide-react'
import useStore from '../store/useStore'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

const AlertPanel = () => {
  const { alerts, acknowledgeAlert, clearAlert } = useStore()

  const activeAlerts = alerts.filter(a => !a.acknowledged)

  if (activeAlerts.length === 0) {
    return null
  }

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md space-y-2">
      {activeAlerts.map((alert) => (
        <div
          key={alert.id}
          className="bg-white rounded-lg shadow-lg border-l-4 border-danger-500 p-4 alert-active"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-danger-600 flex-shrink-0 mt-0.5" size={24} />

            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-danger-900">{alert.title || 'Alerte'}</h3>
              <p className="text-sm text-gray-700 mt-1">{alert.message}</p>
              {alert.device_id && (
                <p className="text-xs text-gray-500 mt-1">Source: {alert.device_id}</p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                {formatDistanceToNow(new Date(alert.timestamp), {
                  addSuffix: true,
                  locale: fr,
                })}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => acknowledgeAlert(alert.id)}
                className="p-1 hover:bg-green-100 rounded transition-colors"
                title="Acquitter"
              >
                <Check size={20} className="text-green-600" />
              </button>
              <button
                onClick={() => clearAlert(alert.id)}
                className="p-1 hover:bg-red-100 rounded transition-colors"
                title="Fermer"
              >
                <X size={20} className="text-red-600" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default AlertPanel
