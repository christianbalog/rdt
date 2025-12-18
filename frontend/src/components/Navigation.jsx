import { Link, useLocation } from 'react-router-dom'
import { Home, Settings, Shield } from 'lucide-react'
import NetworkIndicator from './NetworkIndicator'
import useSettingsStore from '../store/useSettingsStore'
import useNetworkStore from '../store/useNetworkStore'

const Navigation = () => {
  const location = useLocation()
  const { activeScenario, scenarios } = useSettingsStore()
  const { offlineQueue } = useNetworkStore()

  const navItems = [
    { path: '/', name: 'Tableau de bord', icon: <Home size={20} /> },
    { path: '/settings', name: 'Paramètres', icon: <Settings size={20} /> },
  ]

  const currentScenario = scenarios[activeScenario]

  return (
    <header className="bg-white shadow-sm sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <div className="flex items-center gap-4">
            <Shield className="text-primary-600" size={32} />
            <h1 className="text-xl font-bold text-gray-900 hidden sm:block">
              Système de Surveillance
            </h1>
          </div>

          {/* Navigation */}
          <nav className="flex items-center gap-2">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  location.pathname === item.path
                    ? 'bg-primary-100 text-primary-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {item.icon}
                <span className="hidden md:inline">{item.name}</span>
              </Link>
            ))}
          </nav>

          {/* Status indicators */}
          <div className="flex items-center gap-3">
            {/* Queue offline */}
            {offlineQueue.length > 0 && (
              <div className="badge badge-warning flex items-center gap-1">
                <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                {offlineQueue.length} en attente
              </div>
            )}

            {/* Scénario actif */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full text-sm">
              <Shield size={16} className="text-primary-600" />
              <span className="font-medium">{currentScenario?.name}</span>
            </div>

            {/* Network */}
            <NetworkIndicator />
          </div>
        </div>
      </div>
    </header>
  )
}

export default Navigation
