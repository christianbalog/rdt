import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Bell, Camera, Footprints, AlertTriangle } from 'lucide-react'

const EventsList = ({ events, maxItems = 10 }) => {
  const getEventIcon = (type) => {
    switch (type) {
      case 'motion_detected':
        return <Camera className="text-blue-600" size={20} />
      case 'button_pressed':
        return <Footprints className="text-orange-600" size={20} />
      case 'alert':
        return <AlertTriangle className="text-red-600" size={20} />
      default:
        return <Bell className="text-gray-600" size={20} />
    }
  }

  const getEventColor = (type) => {
    switch (type) {
      case 'motion_detected':
        return 'border-l-blue-500 bg-blue-50'
      case 'button_pressed':
        return 'border-l-orange-500 bg-orange-50'
      case 'alert':
        return 'border-l-red-500 bg-red-50'
      default:
        return 'border-l-gray-500 bg-gray-50'
    }
  }

  const getEventTitle = (event) => {
    switch (event.type) {
      case 'motion_detected':
        return 'Mouvement détecté'
      case 'button_pressed':
        return 'Pression sur le tapis'
      case 'alert':
        return event.message || 'Alerte'
      default:
        return 'Événement'
    }
  }

  const displayEvents = events.slice(0, maxItems)

  if (events.length === 0) {
    return (
      <div className="card">
        <h2 className="text-xl font-bold mb-4">Événements récents</h2>
        <div className="text-center py-8 text-gray-500">
          <Bell size={48} className="mx-auto mb-2 opacity-30" />
          <p>Aucun événement pour le moment</p>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Événements récents</h2>
        <span className="badge badge-success">{events.length} total</span>
      </div>

      <div className="space-y-2">
        {displayEvents.map((event, index) => (
          <div
            key={event.id || index}
            className={`border-l-4 ${getEventColor(event.type)} p-3 rounded-r-lg transition-all hover:shadow-md`}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5">{getEventIcon(event.type)}</div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-sm">{getEventTitle(event)}</h3>
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    {formatDistanceToNow(new Date(event.timestamp), {
                      addSuffix: true,
                      locale: fr,
                    })}
                  </span>
                </div>

                <div className="mt-1 text-sm text-gray-600">
                  <p className="truncate">{event.device_id}</p>
                  {event.details && (
                    <p className="text-xs mt-1 text-gray-500">{event.details}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {events.length > maxItems && (
        <div className="mt-4 text-center">
          <button className="text-primary-600 hover:text-primary-700 text-sm font-medium">
            Voir tous les événements ({events.length})
          </button>
        </div>
      )}
    </div>
  )
}

export default EventsList
