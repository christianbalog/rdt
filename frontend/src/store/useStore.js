import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useStore = create(
  persist(
    (set, get) => ({
      // Modes du système
      // 'surveillance': notifications pour tous les capteurs
      // 'actif': notifications uniquement pour le capteur de tapis
      mode: 'actif',

      // État des caméras
      cameras: [
        { id: 'raspberry-01', name: 'Caméra 1', status: 'offline', location: 'Entrée' },
        { id: 'raspberry-02', name: 'Caméra 2', status: 'offline', location: 'Salon' },
      ],

      // Événements en temps réel
      events: [],

      // Alertes actives
      alerts: [],

      // État de connexion WebSocket
      wsConnected: false,

  // Actions
  addEvent: (event) => set((state) => ({
    events: [event, ...state.events].slice(0, 100), // Garde les 100 derniers
  })),

  addAlert: (alert) => set((state) => {
    const newAlert = {
      ...alert,
      id: Date.now(),
      timestamp: new Date().toISOString(),
      acknowledged: false,
    }
    return { alerts: [newAlert, ...state.alerts] }
  }),

  acknowledgeAlert: (alertId) => set((state) => ({
    alerts: state.alerts.map(alert =>
      alert.id === alertId ? { ...alert, acknowledged: true } : alert
    ),
  })),

  clearAlert: (alertId) => set((state) => ({
    alerts: state.alerts.filter(alert => alert.id !== alertId),
  })),

  updateCameraStatus: (cameraId, status) => set((state) => ({
    cameras: state.cameras.map(cam =>
      cam.id === cameraId ? { ...cam, status } : cam
    ),
  })),

  setWsConnected: (connected) => set({ wsConnected: connected }),

  setEvents: (events) => set({ events }),

  // Changer le mode du système
  setMode: (mode) => set({ mode }),
}),
    {
      name: 'surveillance-storage',
      partialize: (state) => ({ mode: state.mode }),
    }
  )
)

export default useStore
