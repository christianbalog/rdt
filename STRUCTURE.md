# 📁 Structure du projet complète

Voici la structure de dossiers recommandée pour votre système :

```
RDT/
├── docker-compose.yml                    # ← Docker compose principal
├── .env                                  # ← Configuration (BACKEND_URL)
│
├── mosquitto/                            # ← Configuration MQTT
│   ├── config/
│   │   └── mosquitto.conf
│   ├── data/                            # ← Données persistantes
│   └── log/                             # ← Logs Mosquitto
│
├── sensor-motion/                        # ← Votre capteur PIR existant
│   ├── Dockerfile                       # ← Votre Dockerfile balena
│   └── sensor_motion.py                 # ← Votre code Python
│
├── sensor-pressure/                      # ← Capteur tapis (optionnel)
│   ├── Dockerfile
│   └── sensor_pressure.py
│
├── mqtt-bridge/                          # ← Bridge MQTT → Backend
│   ├── Dockerfile
│   ├── mqtt-bridge.py
│   └── requirements.txt
│
├── mediamtx/                            # ← Streaming vidéo (optionnel)
│   └── config/
│
├── backend/                              # ← Backend Node.js (pour le cloud)
│   ├── src/
│   │   ├── server.js
│   │   ├── routes/
│   │   │   ├── events.js
│   │   │   └── cameras.js
│   │   └── websocket/
│   │       └── socket.js
│   ├── package.json
│   └── .env
│
└── frontend/                             # ← Frontend React (pour le cloud)
    ├── src/
    │   ├── pages/
    │   │   └── Dashboard.jsx
    │   ├── components/
    │   │   ├── CameraViewWebRTC.jsx
    │   │   ├── ModeSelector.jsx
    │   │   └── AlertPanel.jsx
    │   └── store/
    │       └── useStore.js
    ├── package.json
    └── .env
```

## 🎯 Ce qui tourne OÙ

### 🏠 Sur le Raspberry Pi (Docker Compose Local)
- `mqtt-broker` - Mosquitto MQTT
- `sensor-motion` - Votre capteur PIR
- `sensor-pressure` - Capteur tapis (optionnel)
- `mqtt-bridge` - Pont MQTT → Backend cloud
- `mediamtx` - Streaming vidéo (optionnel)

### ☁️ Sur le Cloud (Serveur distant)
- `backend` - API Node.js + WebSocket
- `frontend` - Interface React

### 📱 Dans le navigateur
- Interface web accessible de partout
