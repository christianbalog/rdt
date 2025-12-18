# 📡 Flux MQTT - Sortie de chaque service

## 🔄 Architecture Globale

```
┌─────────────────┐
│  sensor_motion  │ (Raspberry Pi - Capteur PIR)
│   (Python)      │
└────────┬────────┘
         │ PUBLISH
         │ Topic: sensor/motion
         ▼
┌─────────────────┐
│  mqtt-broker    │ (Mosquitto)
│   (Docker)      │
└────┬─────┬──────┘
     │     │
     │     │ SUBSCRIBE
     │     ▼
     │  ┌──────────────────┐
     │  │ mqtt-bridge      │ (Convertit MQTT → HTTP)
     │  │  (Python)        │
     │  └────────┬─────────┘
     │           │ HTTP POST
     │           ▼
     │  ┌──────────────────┐
     │  │  Backend Cloud   │ (Node.js + Socket.IO)
     │  │  (Express)       │
     │  └──────────────────┘
     │
     │ SUBSCRIBE
     ▼
┌─────────────────────┐
│ surveillance_service│ (Enregistre événements + vidéos)
│     (Python)        │
└─────────────────────┘
```

---

## 1️⃣ Service: **sensor_motion.py**

### 📤 Ce qu'il PUBLIE sur MQTT

**Topic:** `sensor/motion`

**Format du message:**
```json
{
  "event_id": "evt-1737123456-abc123",
  "device_id": "raspberry-1",
  "source": "PIR",
  "type": "MOTION_DETECTED",
  "data": {
    "gpio_pin": 17,
    "state": "HIGH"
  },
  "timestamp": "2025-01-15T14:30:45.123456"
}
```

### 🖥️ Logs typiques

```bash
╔════════════════════════════════════════════════════════════╗
║              Service Capteur de Mouvement                  ║
╚════════════════════════════════════════════════════════════╝

🔌 Connexion au broker MQTT...
✅ Connecté au broker MQTT
📡 Topic de publication: sensor/motion
👀 En attente de mouvement...

🚨 Mouvement détecté!
   Event ID: evt-1737123456-abc123
   GPIO Pin: 17
📤 Message publié sur sensor/motion

⏸️  En attente de 2.0s avant prochaine détection...
```

### 📊 Exemples de messages réels

**Détection de mouvement:**
```json
{
  "event_id": "evt-1737123456-abc123",
  "device_id": "raspberry-1",
  "source": "PIR",
  "type": "MOTION_DETECTED",
  "data": {
    "gpio_pin": 17,
    "state": "HIGH"
  },
  "timestamp": "2025-01-15T14:30:45.123456"
}
```

---

## 2️⃣ Service: **mqtt-bridge**

### 📥 Ce qu'il ÉCOUTE (SUBSCRIBE)

**Topics:**
- `sensor/motion`
- `sensor/button`
- `sensor/pressure`

### 📤 Ce qu'il ENVOIE (HTTP POST)

**Destination:** `https://votre-backend.com/api/events`

**Format du body:**
```json
{
  "type": "motion_detected",
  "device_id": "raspberry-1",
  "details": {
    "event_id": "evt-1737123456-abc123",
    "source": "PIR",
    "data": {
      "gpio_pin": 17,
      "state": "HIGH"
    },
    "original_timestamp": "2025-01-15T14:30:45.123456",
    "mqtt_topic": "sensor/motion"
  }
}
```

### 🖥️ Logs typiques

```bash
╔════════════════════════════════════════════════════════════╗
║                    MQTT → HTTP Bridge                      ║
╚════════════════════════════════════════════════════════════╝

📡 Topics MQTT: sensor/motion, sensor/button, sensor/pressure
🌐 Backend URL: http://backend:8000/api/events

🔌 Connexion au broker MQTT... (tentative 1/10)
✅ Connecté au broker MQTT
📥 Abonné aux topics

✅ Service bridge démarré
🌉 En attente d'événements MQTT...

📨 Message reçu sur sensor/motion
   Event ID: evt-1737123456-abc123
   Type original: MOTION_DETECTED
   Type converti: motion_detected
🌐 Envoi HTTP POST vers http://backend:8000/api/events
✅ Événement envoyé avec succès au backend
   Status: 201
```

### 📊 Mapping des types d'événements

```python
# sensor_motion.py → mqtt-bridge → backend

"MOTION_DETECTED"    →  "motion_detected"
"BUTTON_PRESSED"     →  "button_pressed"
"PRESSURE_DETECTED"  →  "button_pressed"
```

### 🔥 Gestion des erreurs

```bash
❌ Erreur HTTP: Connection refused
   URL: http://backend:8000/api/events
   Détails: Cannot connect to backend
   → L'événement est PERDU (pas de retry pour l'instant)
```

---

## 3️⃣ Service: **surveillance_service.py**

### 📥 Ce qu'il ÉCOUTE (SUBSCRIBE)

**Topics:**
- `sensor/motion`
- `sensor/button`
- `sensor/pressure`

### 💾 Ce qu'il FAIT

1. **Reçoit** l'événement MQTT
2. **Enregistre** l'événement dans `surveillance.db` (table `evenement`)
3. **Si motion détecté:** Capture vidéo 10s
4. **Enregistre** la vidéo dans `surveillance.db` (table `media`)

### 🖥️ Logs typiques

```bash
╔════════════════════════════════════════════════════════════╗
║         Service Surveillance - raspberry-1                 ║
╚════════════════════════════════════════════════════════════╝

📡 MQTT Broker: mqtt-broker:1883
📹 Topics: sensor/motion, sensor/button, sensor/pressure
⏱️  Durée enregistrement: 10s
💾 Base de données: /data/surveillance.db

📊 Initialisation de la base de données...
✅ Base de données initialisée

🔌 Connexion au broker MQTT... (tentative 1/10)
✅ Connecté au broker MQTT
📥 Abonné aux topics

✅ Service de surveillance démarré
👀 En attente d'événements...
   (Ctrl+C pour arrêter)

🚨 Événement reçu: MOTION_DETECTED
   Event ID: evt-1737123456-abc123
   Topic: sensor/motion
✅ Événement enregistré (ID: 1)

📹 Démarrage enregistrement vidéo...
   Fichier: /tmp/videos/recording_evt-1737123456-abc123_1737123456.h264
   Durée: 10s
   Tentative avec libcamera-vid...
   ⚠️  libcamera-vid non disponible: [Errno 2] No such file or directory: 'libcamera-vid'
   Tentative avec ffmpeg...
   ✅ Capturé avec ffmpeg
✅ Enregistrement terminé
💾 Vidéo capturée: 2457600 bytes
✅ Vidéo enregistrée (ID: 1)
   Taille: 2400.00 KB
```

### 📊 Flux de données complet

```
Message MQTT reçu:
{
  "event_id": "evt-123",
  "type": "MOTION_DETECTED",
  "device_id": "raspberry-1",
  ...
}
              ↓
┌─────────────────────────────────┐
│ Table: evenement                │
├─────────────────────────────────┤
│ id_evenement: 1                 │
│ event_id: "evt-123"             │
│ date_evenement: "2025-01-15..." │
│ timestamp: 1737123456.123       │
│ etat_capteur: 1                 │
│ id_capteur: 1 (PIR Entrée)      │
│ metadata: "{...}"               │
└─────────────────────────────────┘
              ↓
    Capture vidéo 10s
              ↓
┌─────────────────────────────────┐
│ Table: media                    │
├─────────────────────────────────┤
│ id_media: 1                     │
│ type_media: "video"             │
│ video: <BLOB 2.4 MB>            │
│ taille: 2457600                 │
│ duree: 10                       │
│ id_evenement: 1                 │
│ id_capteur: 4 (Caméra 1)        │
│ numero_camera: 1                │
│ resolution: "1280x720"          │
│ codec: "h264"                   │
└─────────────────────────────────┘
```

---

## 4️⃣ Service: **mqtt-broker** (Mosquitto)

### 🖥️ Logs typiques

```bash
1737123450: mosquitto version 2.0.18 starting
1737123450: Config loaded from /mosquitto/config/mosquitto.conf
1737123450: Opening ipv4 listen socket on port 1883.
1737123450: Opening ipv6 listen socket on port 1883.
1737123450: mosquitto version 2.0.18 running

1737123455: New connection from 172.18.0.3:45678 on port 1883.
1737123455: New client connected from 172.18.0.3:45678 as sensor-motion-raspberry-1 (p2, c1, k60).

1737123460: New connection from 172.18.0.4:45679 on port 1883.
1737123460: New client connected from 172.18.0.4:45679 as mqtt-bridge-raspberry-1 (p2, c1, k60).

1737123465: New connection from 172.18.0.5:45680 on port 1883.
1737123465: New client connected from 172.18.0.5:45680 as surveillance-raspberry-1 (p2, c1, k60).

1737123470: Received PUBLISH from sensor-motion-raspberry-1 (d0, q1, r0, m1, 'sensor/motion', ... (234 bytes))
1737123470: Sending PUBLISH to mqtt-bridge-raspberry-1 (d0, q1, r0, m1, 'sensor/motion', ... (234 bytes))
1737123470: Sending PUBLISH to surveillance-raspberry-1 (d0, q1, r0, m1, 'sensor/motion', ... (234 bytes))
1737123470: Received PUBACK from mqtt-bridge-raspberry-1 (Mid: 1, RC:0)
1737123470: Received PUBACK from surveillance-raspberry-1 (Mid: 1, RC:0)
```

### 📊 Statistiques du broker

```bash
# Voir les clients connectés
docker compose exec mqtt-broker mosquitto_sub -t '$SYS/broker/clients/connected' -C 1

# Voir le nombre de messages
docker compose exec mqtt-broker mosquitto_sub -t '$SYS/broker/messages/received' -C 1
```

---

## 5️⃣ Backend Cloud (Node.js)

### 📥 Ce qu'il REÇOIT (HTTP POST de mqtt-bridge)

**Endpoint:** `POST /api/events`

**Body:**
```json
{
  "type": "motion_detected",
  "device_id": "raspberry-1",
  "details": {
    "event_id": "evt-1737123456-abc123",
    "source": "PIR",
    "data": {
      "gpio_pin": 17,
      "state": "HIGH"
    },
    "original_timestamp": "2025-01-15T14:30:45.123456",
    "mqtt_topic": "sensor/motion"
  }
}
```

### 📤 Ce qu'il ÉMET (WebSocket vers frontend)

**Event:** `motion_detected`

**Payload:**
```json
{
  "device_id": "raspberry-1",
  "timestamp": "2025-01-15T14:30:45.678Z",
  "location": "Entrée",
  "details": {
    "event_id": "evt-1737123456-abc123",
    "source": "PIR"
  }
}
```

### 🖥️ Logs typiques

```bash
Server running on port 8000

✅ WebSocket client connected: socket-abc123
📥 POST /api/events - 201
   Type: motion_detected
   Device: raspberry-1
   Event ID: evt-1737123456-abc123
📤 WebSocket emit: motion_detected → 3 clients
```

---

## 📋 Résumé des Topics MQTT

| Topic | Publisher | Subscribers | Fréquence |
|-------|-----------|-------------|-----------|
| `sensor/motion` | sensor_motion.py | mqtt-bridge, surveillance_service | À chaque détection (min 2s entre) |
| `sensor/button` | sensor_button.py | mqtt-bridge, surveillance_service | À chaque appui |
| `sensor/pressure` | sensor_pressure.py | mqtt-bridge, surveillance_service | À chaque détection |

---

## 🔍 Comment Tester les Flux

### 1. Écouter tous les messages MQTT

```bash
docker compose exec mqtt-broker mosquitto_sub -v -t '#'
```

**Sortie attendue:**
```
sensor/motion {"event_id":"evt-123","type":"MOTION_DETECTED",...}
sensor/button {"event_id":"evt-124","type":"BUTTON_PRESSED",...}
```

### 2. Publier manuellement pour tester

```bash
docker compose exec mqtt-broker mosquitto_pub \
  -t 'sensor/motion' \
  -m '{"event_id":"test-123","device_id":"raspberry-1","source":"PIR","type":"MOTION_DETECTED","data":{"gpio_pin":17,"state":"HIGH"},"timestamp":"2025-01-15T14:30:45.123456"}'
```

### 3. Vérifier les logs de chaque service

```bash
# mqtt-bridge
docker compose logs -f mqtt-bridge

# surveillance_service
docker compose logs -f capture-video

# mqtt-broker
docker compose logs -f mqtt-broker
```

### 4. Vérifier la base de données

```bash
docker compose exec capture-video sqlite3 /data/surveillance.db \
  "SELECT e.event_id, e.date_evenement, c.nom_capteur
   FROM evenement e
   JOIN capteur c ON e.id_capteur = c.id_capteur
   ORDER BY e.timestamp DESC LIMIT 5;"
```

---

## 🐛 Troubleshooting

### Problème: Messages MQTT non reçus

```bash
# Vérifier que le broker est actif
docker compose ps mqtt-broker

# Vérifier les connexions
docker compose logs mqtt-broker | grep "New client"

# Tester la publication
docker compose exec mqtt-broker mosquitto_pub -t 'test' -m 'hello'
docker compose exec mqtt-broker mosquitto_sub -t 'test' -C 1
```

### Problème: mqtt-bridge n'envoie pas au backend

```bash
# Vérifier les logs
docker compose logs mqtt-bridge | grep "HTTP POST"

# Vérifier la connectivité réseau
docker compose exec mqtt-bridge ping backend

# Tester l'endpoint manuellement
curl -X POST http://localhost:8000/api/events \
  -H "Content-Type: application/json" \
  -d '{"type":"motion_detected","device_id":"test"}'
```

### Problème: Vidéos non enregistrées

```bash
# Vérifier les logs de capture
docker compose logs capture-video | grep "Capturé"

# Vérifier la base de données
docker compose exec capture-video sqlite3 /data/surveillance.db \
  "SELECT COUNT(*) FROM media;"

# Vérifier les permissions caméra
docker compose exec capture-video ls -l /dev/video0
```

---

## 📊 Diagramme de Séquence Complet

```
Capteur PIR          MQTT Broker         mqtt-bridge        Backend         surveillance_service    surveillance.db
    |                     |                    |                |                    |                    |
    |--- Motion ---->     |                    |                |                    |                    |
    |                     |                    |                |                    |                    |
    | PUBLISH             |                    |                |                    |                    |
    | sensor/motion       |                    |                |                    |                    |
    |-------------------->|                    |                |                    |                    |
    |                     |                    |                |                    |                    |
    |                     | PUBLISH            |                |                    |                    |
    |                     |------------------->|                |                    |                    |
    |                     |                    |                |                    |                    |
    |                     |                    | POST /api/events                    |                    |
    |                     |                    |--------------->|                    |                    |
    |                     |                    |                |                    |                    |
    |                     |                    |                | WebSocket          |                    |
    |                     |                    |                | motion_detected    |                    |
    |                     |                    |                |---> Frontend       |                    |
    |                     |                    |                |                    |                    |
    |                     | PUBLISH            |                |                    |                    |
    |                     |----------------------------------------------->|          |                    |
    |                     |                    |                |         |          |                    |
    |                     |                    |                |         | INSERT evenement              |
    |                     |                    |                |         |------------------------->     |
    |                     |                    |                |         |          |                    |
    |                     |                    |                |         | Start recording              |
    |                     |                    |                |         | (10s)    |                    |
    |                     |                    |                |         |          |                    |
    |                     |                    |                |         | INSERT media                 |
    |                     |                    |                |         |------------------------->     |
    |                     |                    |                |         |          |                    |
```

---

## ✅ Checklist de Vérification

- [ ] mqtt-broker démarre et écoute sur le port 1883
- [ ] sensor_motion.py se connecte au broker et publie sur `sensor/motion`
- [ ] mqtt-bridge reçoit les messages et les envoie au backend
- [ ] Backend répond 201 Created à mqtt-bridge
- [ ] Backend émet les événements via WebSocket
- [ ] surveillance_service reçoit les messages MQTT
- [ ] surveillance_service enregistre dans surveillance.db
- [ ] surveillance_service capture des vidéos
- [ ] Les vidéos sont accessibles via l'API

---

Besoin d'aide pour déboguer un service spécifique? Utilisez les commandes de troubleshooting ci-dessus! 🔧
