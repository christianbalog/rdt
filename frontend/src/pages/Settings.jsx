import { useState } from 'react'
import { Settings as SettingsIcon, Zap, Bell, Clock, Video, Wifi, Shield } from 'lucide-react'
import useSettingsStore from '../store/useSettingsStore'
import useNetworkStore from '../store/useNetworkStore'
import NetworkIndicator from '../components/NetworkIndicator'
import SimulationPanel from '../components/SimulationPanel'

const Settings = () => {
  const [activeTab, setActiveTab] = useState('scenarios')
  const [showSimulation, setShowSimulation] = useState(false)

  const {
    activeScenario,
    scenarios,
    setScenario,
    networkSettings,
    updateNetworkSettings,
    notificationSettings,
    updateNotificationSettings,
    recordingSettings,
    updateRecordingSettings,
    schedules,
    updateSchedule,
    deleteSchedule,
  } = useSettingsStore()

  const { stats, getUptimePercentage } = useNetworkStore()

  const tabs = [
    { id: 'scenarios', name: 'Scénarios', icon: <Shield size={18} /> },
    { id: 'notifications', name: 'Notifications', icon: <Bell size={18} /> },
    { id: 'network', name: 'Réseau', icon: <Wifi size={18} /> },
    { id: 'recording', name: 'Enregistrement', icon: <Video size={18} /> },
    { id: 'schedules', name: 'Horaires', icon: <Clock size={18} /> },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SettingsIcon size={28} />
              <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>
            </div>
            <NetworkIndicator />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="card sticky top-6">
              <nav className="space-y-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                      activeTab === tab.id
                        ? 'bg-primary-100 text-primary-700 font-medium'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {tab.icon}
                    {tab.name}
                  </button>
                ))}

                <button
                  onClick={() => setShowSimulation(true)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-orange-600 hover:bg-orange-50 transition-colors border-t border-gray-200 mt-4 pt-4"
                >
                  <Zap size={18} />
                  Simulation de pannes
                </button>
              </nav>
            </div>
          </div>

          {/* Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Scénarios */}
            {activeTab === 'scenarios' && (
              <div className="card">
                <h2 className="text-xl font-bold mb-4">Scénarios de Surveillance</h2>
                <p className="text-gray-600 mb-6">
                  Choisissez un scénario prédéfini qui adapte automatiquement les paramètres de surveillance à votre situation.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(scenarios).map(([key, scenario]) => (
                    <div
                      key={key}
                      onClick={() => setScenario(key)}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        activeScenario === key
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-primary-300'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-lg">{scenario.name}</h3>
                        {activeScenario === key && (
                          <span className="badge badge-success">Actif</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-3">{scenario.description}</p>

                      <div className="space-y-1 text-xs">
                        {scenario.settings.motionDetection && (
                          <div className="flex items-center gap-2 text-green-700">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            Détection de mouvement
                          </div>
                        )}
                        {scenario.settings.recordingEnabled && (
                          <div className="flex items-center gap-2 text-green-700">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            Enregistrement automatique
                          </div>
                        )}
                        {scenario.settings.notificationSound && (
                          <div className="flex items-center gap-2 text-green-700">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            Alertes sonores
                          </div>
                        )}
                        {!scenario.settings.alertsEnabled && (
                          <div className="flex items-center gap-2 text-gray-500">
                            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                            Alertes désactivées
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h3 className="font-semibold text-blue-900 mb-2">💡 Conseil</h3>
                  <p className="text-sm text-blue-800">
                    Vous pouvez automatiser le changement de scénario selon les horaires dans l'onglet "Horaires".
                  </p>
                </div>
              </div>
            )}

            {/* Notifications */}
            {activeTab === 'notifications' && (
              <div className="card">
                <h2 className="text-xl font-bold mb-4">Notifications</h2>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">Son des alertes</p>
                      <p className="text-sm text-gray-600">Jouer un son lors d'une alerte</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notificationSettings.sound}
                        onChange={(e) => updateNotificationSettings({ sound: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">Notifications bureau</p>
                      <p className="text-sm text-gray-600">Afficher les notifications du navigateur</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notificationSettings.desktop}
                        onChange={(e) => updateNotificationSettings({ desktop: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">Email</p>
                      <p className="text-sm text-gray-600">Recevoir les alertes par email</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notificationSettings.email}
                        onChange={(e) => updateNotificationSettings({ email: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>

                  {notificationSettings.email && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <label className="block text-sm font-medium mb-2">Adresse email</label>
                      <input
                        type="email"
                        value={notificationSettings.emailAddress}
                        onChange={(e) => updateNotificationSettings({ emailAddress: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="votre@email.com"
                      />
                    </div>
                  )}

                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-medium">Heures silencieuses</p>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notificationSettings.quiet_hours.enabled}
                          onChange={(e) => updateNotificationSettings({
                            quiet_hours: { ...notificationSettings.quiet_hours, enabled: e.target.checked }
                          })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                      </label>
                    </div>
                    {notificationSettings.quiet_hours.enabled && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm mb-1">Début</label>
                          <input
                            type="time"
                            value={notificationSettings.quiet_hours.start}
                            onChange={(e) => updateNotificationSettings({
                              quiet_hours: { ...notificationSettings.quiet_hours, start: e.target.value }
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-sm mb-1">Fin</label>
                          <input
                            type="time"
                            value={notificationSettings.quiet_hours.end}
                            onChange={(e) => updateNotificationSettings({
                              quiet_hours: { ...notificationSettings.quiet_hours, end: e.target.value }
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Network */}
            {activeTab === 'network' && (
              <div className="space-y-6">
                <div className="card">
                  <h2 className="text-xl font-bold mb-4">État du Réseau</h2>
                  <NetworkIndicator detailed />

                  <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">Uptime</p>
                      <p className="text-2xl font-bold text-green-600">{getUptimePercentage()}%</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">Reconnexions</p>
                      <p className="text-2xl font-bold">{stats.reconnectCount}</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">Downtime total</p>
                      <p className="text-2xl font-bold">{Math.round(stats.totalDowntime / 1000)}s</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">Latence moy.</p>
                      <p className="text-2xl font-bold">{stats.latency}ms</p>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <h2 className="text-xl font-bold mb-4">Paramètres Réseau</h2>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">Reconnexion automatique</p>
                        <p className="text-sm text-gray-600">Se reconnecter automatiquement en cas de perte</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={networkSettings.autoReconnect}
                          onChange={(e) => updateNetworkSettings({ autoReconnect: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">Mode offline</p>
                        <p className="text-sm text-gray-600">Continuer à fonctionner sans connexion</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={networkSettings.offlineMode}
                          onChange={(e) => updateNetworkSettings({ offlineMode: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                      </label>
                    </div>

                    <div className="p-3 bg-gray-50 rounded-lg">
                      <label className="block font-medium mb-3">Qualité vidéo</label>
                      <select
                        value={networkSettings.videoQuality}
                        onChange={(e) => updateNetworkSettings({ videoQuality: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="auto">Automatique (recommandé)</option>
                        <option value="high">Haute (1080p)</option>
                        <option value="medium">Moyenne (720p)</option>
                        <option value="low">Basse (480p)</option>
                      </select>
                      <p className="text-sm text-gray-600 mt-2">
                        La qualité automatique s'adapte à votre connexion
                      </p>
                    </div>

                    <div className="p-3 bg-gray-50 rounded-lg">
                      <label className="block font-medium mb-3">Intervalle de reconnexion</label>
                      <input
                        type="range"
                        min="1000"
                        max="30000"
                        step="1000"
                        value={networkSettings.reconnectInterval}
                        onChange={(e) => updateNetworkSettings({ reconnectInterval: parseInt(e.target.value) })}
                        className="w-full"
                      />
                      <p className="text-sm text-gray-600 mt-2">
                        {networkSettings.reconnectInterval / 1000} secondes
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Recording */}
            {activeTab === 'recording' && (
              <div className="card">
                <h2 className="text-xl font-bold mb-4">Enregistrement Vidéo</h2>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">Enregistrement automatique</p>
                      <p className="text-sm text-gray-600">Enregistrer lors d'une détection</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={recordingSettings.autoRecord}
                        onChange={(e) => updateRecordingSettings({ autoRecord: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>

                  <div className="p-3 bg-gray-50 rounded-lg">
                    <label className="block font-medium mb-3">Durée d'enregistrement</label>
                    <input
                      type="range"
                      min="5"
                      max="60"
                      step="5"
                      value={recordingSettings.recordDuration}
                      onChange={(e) => updateRecordingSettings({ recordDuration: parseInt(e.target.value) })}
                      className="w-full"
                    />
                    <p className="text-sm text-gray-600 mt-2">
                      {recordingSettings.recordDuration} secondes
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <label className="block font-medium mb-3">Pré-buffer</label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={recordingSettings.preBuffer}
                        onChange={(e) => updateRecordingSettings({ preBuffer: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                      <p className="text-sm text-gray-600 mt-1">secondes avant</p>
                    </div>

                    <div className="p-3 bg-gray-50 rounded-lg">
                      <label className="block font-medium mb-3">Post-buffer</label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={recordingSettings.postBuffer}
                        onChange={(e) => updateRecordingSettings({ postBuffer: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                      <p className="text-sm text-gray-600 mt-1">secondes après</p>
                    </div>
                  </div>

                  <div className="p-3 bg-gray-50 rounded-lg">
                    <label className="block font-medium mb-3">Rétention des vidéos</label>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={recordingSettings.retentionDays}
                      onChange={(e) => updateRecordingSettings({ retentionDays: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                    <p className="text-sm text-gray-600 mt-2">
                      Les vidéos seront supprimées après {recordingSettings.retentionDays} jours
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Schedules */}
            {activeTab === 'schedules' && (
              <div className="card">
                <h2 className="text-xl font-bold mb-4">Horaires Automatiques</h2>
                <p className="text-gray-600 mb-6">
                  Programmez le changement automatique de scénario selon les jours et heures.
                </p>

                {schedules.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Clock size={48} className="mx-auto mb-2 opacity-30" />
                    <p>Aucun horaire configuré</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {schedules.map((schedule) => (
                      <div key={schedule.id} className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold">{schedule.name}</h3>
                            <p className="text-sm text-gray-600 mt-1">
                              {schedule.startTime} - {schedule.endTime}
                            </p>
                            <p className="text-sm text-gray-600">
                              Scénario: {scenarios[schedule.scenario]?.name}
                            </p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={schedule.enabled}
                              onChange={(e) => updateSchedule(schedule.id, { enabled: e.target.checked })}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Simulation Panel */}
      {showSimulation && <SimulationPanel onClose={() => setShowSimulation(false)} />}
    </div>
  )
}

export default Settings
