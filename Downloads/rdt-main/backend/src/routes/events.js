import express from 'express'
import { emitMotionDetected, emitButtonPressed, emitEvent } from '../websocket/socket.js'

const router = express.Router()

// Stockage en mémoire des événements (pour la démo, en prod utiliser une DB)
let eventsStore = []

// Mapping des sources vers des noms lisibles
const SOURCE_NAMES = {
  'PIR': 'PIR Entrée',
  'Button': 'Bouton Arrêt',
  'Pressure': 'Tapis Salon',
}

// Mapping des sources vers des locations
const DEVICE_LOCATIONS = {
  'raspberry-1': 'Maison',
  'raspberry-2': 'Garage',
}

// POST /api/events - Endpoint pour recevoir les événements MQTT depuis mqtt-bridge
router.post('/', (req, res) => {
  try {
    const { type, device_id, details } = req.body

    // Validation des champs requis
    if (!type) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: type'
      })
    }

    if (!device_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: device_id'
      })
    }

    // Créer l'événement enrichi
    const event = {
      id: Date.now(),
      type: type,
      device_id: device_id,
      timestamp: new Date().toISOString(),
      event_id: details?.event_id || `evt-${Date.now()}`,
      source: details?.source || 'unknown',
      source_name: SOURCE_NAMES[details?.source] || details?.source || 'Capteur inconnu',
      location: DEVICE_LOCATIONS[device_id] || device_id,
      data: details?.data || {},
      mqtt_topic: details?.mqtt_topic || null,
      original_timestamp: details?.original_timestamp || null,
      metadata: details || {}
    }

    console.log('┌─────────────────────────────────────────────────')
    console.log('│ 📥 Événement reçu depuis mqtt-bridge')
    console.log('├─────────────────────────────────────────────────')
    console.log(`│ Type:       ${event.type}`)
    console.log(`│ Device:     ${event.device_id}`)
    console.log(`│ Source:     ${event.source_name}`)
    console.log(`│ Event ID:   ${event.event_id}`)
    console.log(`│ Location:   ${event.location}`)
    console.log(`│ MQTT Topic: ${event.mqtt_topic}`)
    console.log(`│ Data:       ${JSON.stringify(event.data)}`)
    console.log('└─────────────────────────────────────────────────')

    // Stocker l'événement
    eventsStore.unshift(event)
    if (eventsStore.length > 100) {
      eventsStore = eventsStore.slice(0, 100) // Garder seulement les 100 derniers
    }

    // Diffuser l'événement via WebSocket selon son type
    switch (event.type) {
      case 'motion_detected':
        emitMotionDetected({
          device_id: event.device_id,
          timestamp: event.timestamp,
          location: event.location,
          source: event.source_name,
          details: {
            event_id: event.event_id,
            source: event.source,
            data: event.data
          }
        })
        console.log(`📤 WebSocket: motion_detected émis vers les clients`)
        break

      case 'button_pressed':
        emitButtonPressed({
          device_id: event.device_id,
          timestamp: event.timestamp,
          location: event.location,
          button_name: event.source_name,
          details: {
            event_id: event.event_id,
            source: event.source,
            data: event.data
          }
        })
        console.log(`📤 WebSocket: button_pressed émis vers les clients`)
        break

      default:
        emitEvent('event', event)
        console.log(`📤 WebSocket: event générique émis vers les clients`)
        break
    }

    // Réponse au mqtt-bridge
    res.status(201).json({
      success: true,
      event: {
        id: event.id,
        type: event.type,
        timestamp: event.timestamp
      }
    })
  } catch (error) {
    console.error('┌─────────────────────────────────────────────────')
    console.error('│ ❌ Erreur lors du traitement de l\'événement')
    console.error('├─────────────────────────────────────────────────')
    console.error(`│ Message: ${error.message}`)
    console.error(`│ Stack:   ${error.stack}`)
    console.error('└─────────────────────────────────────────────────')

    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// GET /api/events - Récupérer les événements récents
router.get('/', (req, res) => {
  const limit = parseInt(req.query.limit) || 50
  res.json(eventsStore.slice(0, limit))
})

// GET /api/events/:id - Récupérer un événement spécifique
router.get('/:id', (req, res) => {
  const event = eventsStore.find(e => e.id === parseInt(req.params.id))
  if (event) {
    res.json(event)
  } else {
    res.status(404).json({ error: 'Événement non trouvé' })
  }
})

export default router
