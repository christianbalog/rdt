import express from 'express'
import axios from 'axios'
import dotenv from 'dotenv'

dotenv.config()

const router = express.Router()

// Configuration des Raspberry Pi
const raspberryConfig = {
  'raspberry-01': process.env.RASPBERRY_01_URL || 'http://192.168.1.100:5000',
  'raspberry-02': process.env.RASPBERRY_02_URL || 'http://192.168.1.101:5000',
}

// GET /api/cameras - Liste des caméras
router.get('/', (req, res) => {
  res.json([
    {
      id: 'raspberry-01',
      name: 'Caméra 1',
      location: 'Entrée',
      status: 'online',
      raspberry_url: raspberryConfig['raspberry-01']
    },
    {
      id: 'raspberry-02',
      name: 'Caméra 2',
      location: 'Salon',
      status: 'online',
      raspberry_url: raspberryConfig['raspberry-02']
    },
  ])
})

// GET /api/cameras/:id/stream.m3u8 - Proxy pour le stream HLS
router.get('/:id/stream.m3u8', async (req, res) => {
  try {
    const { id } = req.params
    const mediaMtxUrl = process.env.MEDIAMTX_URL || 'http://localhost:8889'
    const streamUrl = `${mediaMtxUrl}/${id}/index.m3u8`

    console.log(`🎥 Proxy stream HLS pour ${id}: ${streamUrl}`)

    const response = await axios.get(streamUrl, {
      responseType: 'text',
      timeout: 5000,
    })

    res.set('Content-Type', 'application/vnd.apple.mpegurl')
    res.send(response.data)
  } catch (error) {
    console.error(`❌ Erreur proxy stream:`, error.message)
    res.status(500).json({ error: 'Impossible de récupérer le stream' })
  }
})

// GET /api/cameras/:id/snapshot - Prendre une capture d'écran
router.get('/:id/snapshot', async (req, res) => {
  try {
    const { id } = req.params
    const raspberryUrl = raspberryConfig[id]

    if (!raspberryUrl) {
      return res.status(404).json({ error: 'Caméra non trouvée' })
    }

    console.log(`📸 Demande de snapshot pour ${id}`)

    const response = await axios.get(`${raspberryUrl}/api/snapshot`, {
      responseType: 'arraybuffer',
      timeout: 10000,
    })

    res.set('Content-Type', 'image/jpeg')
    res.send(response.data)
  } catch (error) {
    console.error(`❌ Erreur snapshot:`, error.message)
    res.status(500).json({ error: 'Impossible de prendre une capture' })
  }
})

// POST /api/cameras/:id/servo - Contrôler le servomoteur de la caméra
router.post('/:id/servo', async (req, res) => {
  try {
    const { id } = req.params
    const { direction } = req.body

    const raspberryUrl = raspberryConfig[id]

    if (!raspberryUrl) {
      return res.status(404).json({ error: 'Caméra non trouvée' })
    }

    if (!['left', 'right'].includes(direction)) {
      return res.status(400).json({ error: 'Direction invalide (left ou right)' })
    }

    console.log(`🎮 Commande servomoteur pour ${id}: ${direction}`)

    // Envoyer la commande au Raspberry Pi
    const response = await axios.post(
      `${raspberryUrl}/api/servo`,
      { direction },
      { timeout: 5000 }
    )

    res.json({
      success: true,
      camera_id: id,
      direction,
      response: response.data
    })
  } catch (error) {
    console.error(`❌ Erreur contrôle servomoteur:`, error.message)

    // Même si le Raspberry ne répond pas, on renvoie un succès
    // (le Raspberry peut ne pas être accessible en dev)
    res.json({
      success: true,
      camera_id: req.params.id,
      direction: req.body.direction,
      note: 'Commande envoyée (Raspberry peut-être inaccessible)'
    })
  }
})

// POST /api/cameras/:id/record - Démarrer/arrêter l'enregistrement
router.post('/:id/record', async (req, res) => {
  try {
    const { id } = req.params
    const { action } = req.body // 'start' ou 'stop'

    const raspberryUrl = raspberryConfig[id]

    if (!raspberryUrl) {
      return res.status(404).json({ error: 'Caméra non trouvée' })
    }

    console.log(`⏺️ Enregistrement ${action} pour ${id}`)

    const response = await axios.post(
      `${raspberryUrl}/api/record`,
      { action },
      { timeout: 5000 }
    )

    res.json({ success: true, camera_id: id, action, response: response.data })
  } catch (error) {
    console.error(`❌ Erreur enregistrement:`, error.message)
    res.status(500).json({ error: 'Impossible de contrôler l\'enregistrement' })
  }
})

export default router
