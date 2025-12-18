import { useState } from 'react'
import { Zap, WifiOff, Signal, ShuffleIcon, X } from 'lucide-react'
import useNetworkStore from '../store/useNetworkStore'
import useSettingsStore from '../store/useSettingsStore'
import useStore from '../store/useStore'

const SimulationPanel = ({ onClose }) => {
  const [selectedSimulation, setSelectedSimulation] = useState(null)
  const { simulateOutage, simulateSlowConnection, simulateUnstableConnection } = useNetworkStore()
  const { simulationMode, enableSimulation, disableSimulation } = useSettingsStore()
  const { updateCameraStatus } = useStore()

  const simulations = [
    {
      id: 'offline',
      name: 'Panne Internet',
      description: 'Simule une coupure Internet de 10 secondes',
      icon: <WifiOff className="text-red-500" size={24} />,
      duration: 10000,
      action: () => {
        enableSimulation('offline')
        simulateOutage(10000)
        setTimeout(() => disableSimulation(), 10000)
      }
    },
    {
      id: 'slow',
      name: 'Connexion Lente',
      description: 'Simule une connexion avec haute latence (500ms)',
      icon: <Signal className="text-orange-500" size={24} />,
      action: () => {
        enableSimulation('slow')
        simulateSlowConnection()
        setTimeout(() => disableSimulation(), 15000)
      }
    },
    {
      id: 'unstable',
      name: 'Connexion Instable',
      description: 'Simule des déconnexions répétées',
      icon: <ShuffleIcon className="text-yellow-500" size={24} />,
      action: () => {
        enableSimulation('unstable')
        simulateUnstableConnection()
        setTimeout(() => disableSimulation(), 20000)
      }
    },
    {
      id: 'camera_down',
      name: 'Caméra Hors Ligne',
      description: 'Simule la perte de connexion d\'une caméra',
      icon: <WifiOff className="text-purple-500" size={24} />,
      action: () => {
        enableSimulation('camera_down', ['raspberry-01'])
        updateCameraStatus('raspberry-01', 'offline')
        setTimeout(() => {
          updateCameraStatus('raspberry-01', 'online')
          disableSimulation()
        }, 15000)
      }
    },
  ]

  const handleSimulate = (simulation) => {
    setSelectedSimulation(simulation.id)
    simulation.action()

    // Reset après la durée de simulation
    setTimeout(() => {
      setSelectedSimulation(null)
    }, simulation.duration || 15000)
  }

  const handleStop = () => {
    disableSimulation()
    setSelectedSimulation(null)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Zap className="text-primary-600" size={24} />
            <h2 className="text-xl font-bold">Simulation de Pannes</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {simulationMode.enabled && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-300 rounded-lg">
              <div className="flex items-start gap-3">
                <Zap className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
                <div className="flex-1">
                  <h3 className="font-semibold text-yellow-900">Simulation en cours</h3>
                  <p className="text-sm text-yellow-700 mt-1">
                    Type: {simulationMode.type}
                  </p>
                  <button
                    onClick={handleStop}
                    className="mt-3 btn-danger text-sm"
                  >
                    Arrêter la simulation
                  </button>
                </div>
              </div>
            </div>
          )}

          <p className="text-gray-600 mb-6">
            Testez la résilience du système en simulant différents scénarios de panne.
            Le système passera automatiquement en mode offline et stockera les événements
            localement jusqu'au retour de la connexion.
          </p>

          <div className="space-y-4">
            {simulations.map((sim) => (
              <div
                key={sim.id}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  selectedSimulation === sim.id
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'
                }`}
                onClick={() => !simulationMode.enabled && handleSimulate(sim)}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">{sim.icon}</div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{sim.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">{sim.description}</p>
                    {selectedSimulation === sim.id && (
                      <div className="mt-3">
                        <div className="flex items-center gap-2 text-sm text-primary-600">
                          <div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
                          Simulation en cours...
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">💡 Comportements testés</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Mise en queue des événements pendant la panne</li>
              <li>• Synchronisation automatique au retour de la connexion</li>
              <li>• Affichage des indicateurs de statut réseau</li>
              <li>• Reconnexion automatique des flux WebRTC</li>
              <li>• Gestion du mode offline pour l'interface</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SimulationPanel
