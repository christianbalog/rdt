import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useSettingsStore = create(
  persist(
    (set, get) => ({
      // Scénarios prédéfinis
      activeScenario: 'normal',
      scenarios: {
        normal: {
          name: 'Normal',
          description: 'Surveillance standard avec alertes',
          settings: {
            alertsEnabled: true,
            motionDetection: true,
            buttonDetection: true,
            recordingEnabled: false,
            notificationSound: true,
            notificationDesktop: true,
          }
        },
        discreet: {
          name: 'Discret',
          description: 'Surveillance silencieuse sans alertes sonores',
          settings: {
            alertsEnabled: true,
            motionDetection: true,
            buttonDetection: true,
            recordingEnabled: true,
            notificationSound: false,
            notificationDesktop: false,
          }
        },
        night: {
          name: 'Mode Nuit',
          description: 'Surveillance nocturne renforcée',
          settings: {
            alertsEnabled: true,
            motionDetection: true,
            buttonDetection: true,
            recordingEnabled: true,
            notificationSound: true,
            notificationDesktop: true,
            motionSensitivity: 'high',
            autoRecord: true,
          }
        },
        away: {
          name: 'Absence',
          description: 'Mode absence - alertes maximales',
          settings: {
            alertsEnabled: true,
            motionDetection: true,
            buttonDetection: true,
            recordingEnabled: true,
            notificationSound: true,
            notificationDesktop: true,
            notificationEmail: true,
            notificationSMS: true,
            motionSensitivity: 'high',
            autoRecord: true,
          }
        },
        home: {
          name: 'À la maison',
          description: 'Mode présence - surveillance légère',
          settings: {
            alertsEnabled: false,
            motionDetection: false,
            buttonDetection: true,
            recordingEnabled: false,
            notificationSound: false,
            notificationDesktop: false,
          }
        },
        off: {
          name: 'Désactivé',
          description: 'Surveillance désactivée',
          settings: {
            alertsEnabled: false,
            motionDetection: false,
            buttonDetection: false,
            recordingEnabled: false,
            notificationSound: false,
            notificationDesktop: false,
          }
        }
      },

      // Paramètres réseau
      networkSettings: {
        autoReconnect: true,
        reconnectInterval: 5000, // ms
        maxRetries: 10,
        offlineMode: true,
        cacheDuration: 24, // heures
        lowBandwidthMode: false,
        videoQuality: 'auto', // auto, high, medium, low
      },

      // Zones de détection
      detectionZones: {
        'raspberry-01': {
          enabled: true,
          sensitivity: 'medium',
          schedule: {
            enabled: false,
            times: []
          }
        },
        'raspberry-02': {
          enabled: true,
          sensitivity: 'medium',
          schedule: {
            enabled: false,
            times: []
          }
        }
      },

      // Horaires de surveillance
      schedules: [
        {
          id: 1,
          name: 'Heures de travail',
          enabled: true,
          days: [1, 2, 3, 4, 5], // Lun-Ven
          startTime: '08:00',
          endTime: '18:00',
          scenario: 'away'
        },
        {
          id: 2,
          name: 'Nuit',
          enabled: true,
          days: [0, 1, 2, 3, 4, 5, 6], // Tous les jours
          startTime: '22:00',
          endTime: '07:00',
          scenario: 'night'
        }
      ],

      // Simulation de panne (pour tests)
      simulationMode: {
        enabled: false,
        type: null, // 'offline', 'slow', 'unstable', 'camera_down'
        affectedCameras: [],
      },

      // Notifications avancées
      notificationSettings: {
        sound: true,
        desktop: true,
        email: false,
        sms: false,
        emailAddress: '',
        phoneNumber: '',
        quiet_hours: {
          enabled: false,
          start: '22:00',
          end: '07:00'
        }
      },

      // Enregistrement
      recordingSettings: {
        autoRecord: false,
        recordDuration: 15, // secondes
        preBuffer: 5, // secondes avant l'événement
        postBuffer: 5, // secondes après l'événement
        storageLimit: 50, // GB
        retentionDays: 7,
      },

      // Actions
      setScenario: (scenario) => set({ activeScenario: scenario }),

      updateNetworkSettings: (settings) => set((state) => ({
        networkSettings: { ...state.networkSettings, ...settings }
      })),

      updateDetectionZone: (cameraId, settings) => set((state) => ({
        detectionZones: {
          ...state.detectionZones,
          [cameraId]: { ...state.detectionZones[cameraId], ...settings }
        }
      })),

      addSchedule: (schedule) => set((state) => ({
        schedules: [...state.schedules, { ...schedule, id: Date.now() }]
      })),

      updateSchedule: (id, updates) => set((state) => ({
        schedules: state.schedules.map(s => s.id === id ? { ...s, ...updates } : s)
      })),

      deleteSchedule: (id) => set((state) => ({
        schedules: state.schedules.filter(s => s.id !== id)
      })),

      enableSimulation: (type, cameras = []) => set({
        simulationMode: {
          enabled: true,
          type,
          affectedCameras: cameras
        }
      }),

      disableSimulation: () => set({
        simulationMode: {
          enabled: false,
          type: null,
          affectedCameras: []
        }
      }),

      updateNotificationSettings: (settings) => set((state) => ({
        notificationSettings: { ...state.notificationSettings, ...settings }
      })),

      updateRecordingSettings: (settings) => set((state) => ({
        recordingSettings: { ...state.recordingSettings, ...settings }
      })),

      // Récupérer les paramètres du scénario actif
      getActiveSettings: () => {
        const state = get()
        return state.scenarios[state.activeScenario]?.settings || {}
      },

      // Vérifier si on est dans les horaires configurés
      checkSchedule: () => {
        const state = get()
        const now = new Date()
        const currentDay = now.getDay()
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

        const activeSchedule = state.schedules.find(schedule => {
          if (!schedule.enabled) return false
          if (!schedule.days.includes(currentDay)) return false

          const start = schedule.startTime
          const end = schedule.endTime

          // Gérer les horaires qui passent minuit
          if (end < start) {
            return currentTime >= start || currentTime <= end
          }
          return currentTime >= start && currentTime <= end
        })

        if (activeSchedule && activeSchedule.scenario !== state.activeScenario) {
          set({ activeScenario: activeSchedule.scenario })
        }
      }
    }),
    {
      name: 'surveillance-settings',
      partialize: (state) => ({
        activeScenario: state.activeScenario,
        networkSettings: state.networkSettings,
        detectionZones: state.detectionZones,
        schedules: state.schedules,
        notificationSettings: state.notificationSettings,
        recordingSettings: state.recordingSettings,
      })
    }
  )
)

export default useSettingsStore
