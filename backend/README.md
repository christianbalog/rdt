# Backend - Système de Surveillance

Backend Node.js avec Express et Socket.IO pour gérer les caméras, capteurs et événements en temps réel.

## Architecture

```
backend/
├── src/
│   ├── server.js           # Serveur principal Express + Socket.IO
│   ├── routes/
│   │   ├── events.js       # Routes pour les événements (MQTT)
│   │   └── cameras.js      # Routes pour les caméras et servomoteurs
│   └── websocket/
│       └── socket.js       # Gestion WebSocket
├── .env                    # Configuration
└── package.json
```

## Installation

```bash
cd backend
npm install
```

## Configuration

Créer un fichier `.env` avec:

```env
PORT=8000
CORS_ORIGIN=http://localhost:3000
MEDIAMTX_URL=http://localhost:8889

# URLs des Raspberry Pi
RASPBERRY_01_URL=http://192.168.1.100:5000
RASPBERRY_02_URL=http://192.168.1.101:5000
```

## Démarrage

```bash
# Mode développement avec auto-reload
npm run dev

# Mode production
npm start
```

Le serveur démarre sur `http://localhost:8000`

## API Endpoints

### Événements

#### POST /api/events
Endpoint public pour recevoir les événements MQTT depuis les Raspberry Pi.

**Body:**
```json
{
  "type": "motion_detected",
  "device_id": "raspberry-01",
  "details": {
    "confidence": 0.95
  }
}
```

**Types d'événements supportés:**
- `motion_detected` - Mouvement détecté par capteur PIR
- `button_pressed` - Pression sur le tapis/capteur

**Réponse:**
```json
{
  "success": true,
  "event": {
    "id": 1234567890,
    "timestamp": "2024-01-01T12:00:00.000Z",
    "type": "motion_detected",
    "device_id": "raspberry-01",
    "details": { "confidence": 0.95 }
  }
}
```

#### GET /api/events?limit=50
Récupérer les événements récents.

### Caméras

#### GET /api/cameras
Liste des caméras disponibles.

#### GET /api/cameras/:id/stream.m3u8
Proxy pour le stream HLS (via MediaMTX).

#### GET /api/cameras/:id/snapshot
Prendre une capture d'écran de la caméra.

#### POST /api/cameras/:id/servo
Contrôler le servomoteur de la caméra.

**Body:**
```json
{
  "direction": "left"
}
```

**Directions possibles:** `left`, `right`

**Réponse:**
```json
{
  "success": true,
  "camera_id": "raspberry-01",
  "direction": "left"
}
```

#### POST /api/cameras/:id/record
Démarrer/arrêter l'enregistrement.

**Body:**
```json
{
  "action": "start"
}
```

**Actions possibles:** `start`, `stop`

## WebSocket Events

Le backend émet des événements en temps réel via Socket.IO:

### Événements émis par le serveur

- `motion_detected` - Mouvement détecté
  ```json
  {
    "device_id": "raspberry-01",
    "timestamp": "2024-01-01T12:00:00.000Z",
    "details": { "confidence": 0.95 }
  }
  ```

- `button_pressed` - Pression sur le tapis
  ```json
  {
    "device_id": "raspberry-01",
    "timestamp": "2024-01-01T12:00:00.000Z",
    "details": {}
  }
  ```

- `camera_status` - Changement de statut caméra
  ```json
  {
    "camera_id": "raspberry-01",
    "status": "online"
  }
  ```

- `alert` - Alerte système
  ```json
  {
    "title": "Alerte",
    "message": "Message de l'alerte",
    "type": "motion"
  }
  ```

## Flux de données

### Raspberry Pi → Backend → Frontend

1. **Raspberry Pi** détecte un événement (motion, button)
2. **Raspberry Pi** envoie un POST vers `/api/events`
3. **Backend** stocke l'événement en mémoire
4. **Backend** émet l'événement via WebSocket
5. **Frontend** reçoit l'événement en temps réel

```
┌─────────────┐                    ┌─────────────┐                    ┌─────────────┐
│ Raspberry   │  POST /api/events  │   Backend   │   WebSocket Event  │  Frontend   │
│     Pi      │ ──────────────────>│   Express   │ ──────────────────>│    React    │
│             │                    │  Socket.IO  │                    │             │
└─────────────┘                    └─────────────┘                    └─────────────┘
```

### Frontend → Backend → Raspberry Pi

1. **Frontend** envoie une commande servomoteur
2. **Backend** reçoit la commande
3. **Backend** forwarde vers le Raspberry Pi approprié
4. **Raspberry Pi** exécute la commande

```
┌─────────────┐                    ┌─────────────┐                    ┌─────────────┐
│  Frontend   │  POST /api/.../   │   Backend   │  POST /api/servo   │ Raspberry   │
│    React    │      servo         │   Express   │                    │     Pi      │
│             │ ──────────────────>│             │ ──────────────────>│             │
└─────────────┘                    └─────────────┘                    └─────────────┘
```

## Intégration avec les Raspberry Pi

Les Raspberry Pi doivent exposer une API REST avec les endpoints suivants:

### POST /api/servo
Contrôler le servomoteur.
```json
{ "direction": "left" }
```

### GET /api/snapshot
Récupérer une image JPEG de la caméra.

### POST /api/record
Contrôler l'enregistrement.
```json
{ "action": "start" }
```

## Health Check

```bash
curl http://localhost:8000/health
```

Réponse:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```
