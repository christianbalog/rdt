import { Shield, Home } from 'lucide-react'
import useStore from '../store/useStore'

const ModeSelector = () => {
  const { mode, setMode } = useStore()

  const modes = [
    {
      id: 'actif',
      name: 'Actif',
      icon: Home,
      description: 'Notifications uniquement pour le tapis',
      activeClass: 'bg-blue-500 text-white shadow-lg',
    },
    {
      id: 'surveillance',
      name: 'Surveillance',
      icon: Shield,
      description: 'Notifications pour tous les capteurs',
      activeClass: 'bg-red-500 text-white shadow-lg',
    },
  ]

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4">
      <h2 className="text-lg font-semibold mb-3">Mode</h2>
      <div className="grid grid-cols-2 gap-3">
        {modes.map((m) => {
          const Icon = m.icon
          const isActive = mode === m.id

          return (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`
                relative p-4 rounded-xl transition-all duration-200
                ${isActive
                  ? `${m.activeClass} scale-105`
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                }
              `}
            >
              <div className="flex flex-col items-center gap-2">
                <Icon size={24} />
                <span className="font-medium">{m.name}</span>
              </div>

              {isActive && (
                <div className="absolute top-2 right-2">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                </div>
              )}
            </button>
          )
        })}
      </div>

      <p className="mt-3 text-sm text-gray-600 text-center">
        {modes.find(m => m.id === mode)?.description}
      </p>
    </div>
  )
}

export default ModeSelector
