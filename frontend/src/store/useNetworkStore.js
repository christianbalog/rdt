import { create } from 'zustand'

const useNetworkStore = create((set, get) => ({
  // État de la connexion
  isOnline: navigator.onLine,
  connectionQuality: 'good', // good, fair, poor, offline
  lastOnline: Date.now(),
  lastOffline: null,

  // Statistiques réseau
  stats: {
    latency: 0,
    jitter: 0,
    packetLoss: 0,
    bandwidth: 0,
    reconnectCount: 0,
    totalDowntime: 0, // ms
    uptime: 100, // %
  },

  // Historique de connexion
  connectionHistory: [],

  // Queue d'événements offline
  offlineQueue: [],

  // Actions
  setOnline: (online) => {
    const now = Date.now()
    const state = get()

    if (online && !state.isOnline) {
      // Retour en ligne
      const downtime = state.lastOffline ? now - state.lastOffline : 0

      set({
        isOnline: true,
        lastOnline: now,
        connectionQuality: 'good',
        stats: {
          ...state.stats,
          reconnectCount: state.stats.reconnectCount + 1,
          totalDowntime: state.stats.totalDowntime + downtime,
        },
        connectionHistory: [
          ...state.connectionHistory,
          {
            type: 'online',
            timestamp: now,
            downtime,
          }
        ].slice(-100) // Garder les 100 derniers
      })

      // Traiter la queue offline
      if (state.offlineQueue.length > 0) {
        get().processOfflineQueue()
      }
    } else if (!online && state.isOnline) {
      // Passage offline
      set({
        isOnline: false,
        lastOffline: now,
        connectionQuality: 'offline',
        connectionHistory: [
          ...state.connectionHistory,
          {
            type: 'offline',
            timestamp: now,
          }
        ].slice(-100)
      })
    }
  },

  updateConnectionQuality: (quality, metrics = {}) => {
    set((state) => ({
      connectionQuality: quality,
      stats: { ...state.stats, ...metrics }
    }))
  },

  updateLatency: (latency) => {
    set((state) => {
      // Calculer la qualité basée sur la latency
      let quality = 'good'
      if (latency > 300) quality = 'poor'
      else if (latency > 100) quality = 'fair'

      return {
        stats: { ...state.stats, latency },
        connectionQuality: state.isOnline ? quality : 'offline'
      }
    })
  },

  addToOfflineQueue: (event) => {
    set((state) => ({
      offlineQueue: [...state.offlineQueue, {
        ...event,
        queuedAt: Date.now()
      }]
    }))
  },

  processOfflineQueue: async () => {
    const state = get()
    const queue = [...state.offlineQueue]

    if (queue.length === 0) return

    console.log(`Traitement de ${queue.length} événements en attente...`)

    // Simuler l'envoi des événements
    // Dans la vraie implémentation, on enverrait au backend
    for (const event of queue) {
      try {
        // await sendEventToBackend(event)
        console.log('Événement synchronisé:', event)
      } catch (error) {
        console.error('Erreur sync:', error)
        return // Arrêter si échec
      }
    }

    // Vider la queue après succès
    set({ offlineQueue: [] })
  },

  clearOfflineQueue: () => set({ offlineQueue: [] }),

  getUptimePercentage: () => {
    const state = get()
    const totalTime = Date.now() - (state.connectionHistory[0]?.timestamp || Date.now())
    if (totalTime === 0) return 100

    const uptime = ((totalTime - state.stats.totalDowntime) / totalTime) * 100
    return Math.max(0, Math.min(100, uptime)).toFixed(2)
  },

  // Test de connexion
  testConnection: async () => {
    const start = Date.now()

    try {
      const response = await fetch('/api/ping', {
        method: 'GET',
        cache: 'no-cache',
      })

      const latency = Date.now() - start

      if (response.ok) {
        get().updateLatency(latency)
        get().setOnline(true)
        return { success: true, latency }
      } else {
        get().setOnline(false)
        return { success: false, latency }
      }
    } catch (error) {
      get().setOnline(false)
      return { success: false, error: error.message }
    }
  },

  // Simulation de panne (pour tests)
  simulateOutage: (duration = 10000) => {
    get().setOnline(false)

    setTimeout(() => {
      get().setOnline(true)
    }, duration)
  },

  simulateSlowConnection: () => {
    get().updateConnectionQuality('poor', { latency: 500, jitter: 100 })
  },

  simulateUnstableConnection: () => {
    // Simuler des déconnexions aléatoires
    let count = 0
    const interval = setInterval(() => {
      const state = get()
      get().setOnline(!state.isOnline)

      count++
      if (count >= 10) {
        clearInterval(interval)
        get().setOnline(true)
      }
    }, 2000)
  },

  resetStats: () => {
    set({
      stats: {
        latency: 0,
        jitter: 0,
        packetLoss: 0,
        bandwidth: 0,
        reconnectCount: 0,
        totalDowntime: 0,
        uptime: 100,
      },
      connectionHistory: [],
    })
  }
}))

// Écouter les événements online/offline du navigateur
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useNetworkStore.getState().setOnline(true)
  })

  window.addEventListener('offline', () => {
    useNetworkStore.getState().setOnline(false)
  })

  // Test de connexion périodique (toutes les 10 secondes)
  setInterval(() => {
    if (useNetworkStore.getState().isOnline) {
      useNetworkStore.getState().testConnection()
    }
  }, 10000)
}

export default useNetworkStore
