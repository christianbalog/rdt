# Raspberry Pi Services - Architecture MQTT

## 📡 Architecture complète du système

```
┌─────────────────────────────────────────────────────────────────────┐
│                    RASPBERRY PI 1 (raspberry-01)                     │
│                                                                      │
│  ┌──────────────┐   ┌──────────────────────────────────────────┐   │
│  │ Capteur PIR  │──>│  sensor-publisher.py                     │   │
│  │ Capteur Tapis│   │  - Détecte événements GPIO               │   │
│  └──────────────┘   │  - Publie sur MQTT                       │   │
│                     │    · sensors/raspberry-01/motion         │   │
│  ┌──────────────┐   │    · sensors/raspberry-01/button         │   │
│  │ Servomoteur  │<──│  - Écoute commandes MQTT                 │   │
│  │ Caméra       │   │    · commands/raspberry-01/servo         │   │
│  └──────────────┘   └──────────────────────────────────────────┘   │
│                                      │                               │
└──────────────────────────────────────┼───────────────────────────────┘
                                       │ MQTT Publish/Subscribe
                                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│              MQTT BROKER (Mosquitto) - Réseau Local                  │
│              📡 Fonctionne SANS INTERNET                             │
│                                                                      │
│  Topics:                                                             │
│    📥 sensors/raspberry-01/motion      (capteurs → broker)          │
│    📥 sensors/raspberry-01/button                                   │
│    📥 sensors/raspberry-02/motion                                   │
│    📥 sensors/raspberry-02/button                                   │
│    📤 commands/raspberry-01/servo      (broker → actionneurs)       │
│    📤 commands/raspberry-02/servo                                   │
└──────────────────┬──────────────────────────────────────────────────┘
                   │
                   │ MQTT Subscribe + HTTP POST
                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    mqtt-bridge.py                                    │
│              (Peut tourner sur n'importe quelle machine)             │
│                                                                      │
│  1. Écoute tous les événements MQTT                                 │
│  2. Convertit en JSON                                               │
│  3. POST vers Backend HTTP                                          │
│                                                                      │
│  ⚠️  Si Backend offline: log l'erreur, MQTT continue de marcher     │
└──────────────────┬──────────────────────────────────────────────────┘
                   │ HTTP POST /api/events
                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  BACKEND (Node.js + Socket.IO)                       │
│                  🌐 Nécessite internet pour le frontend              │
│                                                                      │
│  - Reçoit événements HTTP                                           │
│  - Stocke en mémoire/DB                                             │
│  - Diffuse via WebSocket                                            │
└──────────────────┬──────────────────────────────────────────────────┘
                   │ WebSocket
                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     FRONTEND (React)                                 │
│                                                                      │
│  - Affiche événements en temps réel                                 │
│  - Contrôle servomoteurs                                            │
│  - Gestion modes (actif/surveillance)                               │
└─────────────────────────────────────────────────────────────────────┘
```

## 🎯 Avantages de cette architecture

### ✅ Résilience maximale

1. **Le système local fonctionne SANS internet**
   - Les Raspberry Pi communiquent via MQTT en local
   - Les capteurs détectent et publient sur MQTT
   - Les servomoteurs reçoivent les commandes via MQTT
   - **Tout fonctionne même si le backend est down**

2. **Le bridge MQTT → Backend est optionnel**
   - Si le bridge tombe : MQTT continue
   - Si le backend est inaccessible : MQTT continue
   - Le bridge peut redémarrer et se reconnecter automatiquement

3. **Découplage total**
   - Les Raspberry Pi ne connaissent pas le backend
   - Le backend ne connaît pas MQTT
   - Chaque composant est indépendant

## 📋 Installation

### Sur chaque Raspberry Pi

```bash
# 1. Installer les dépendances
pip3 install -r requirements.txt

# 2. Configurer les variables d'environnement
export MQTT_BROKER="192.168.1.50"  # IP du broker Mosquitto
export DEVICE_ID="raspberry-01"

# 3. Lancer le publisher des capteurs
python3 sensor-publisher.py
```

### Sur le serveur du Bridge MQTT

Peut être:
- Un Raspberry Pi dédié
- Le même Pi que le broker Mosquitto
- Un serveur séparé

```bash
# 1. Installer les dépendances
pip3 install -r requirements.txt

# 2. Configurer les variables d'environnement
export MQTT_BROKER="localhost"      # ou IP du broker
export BACKEND_URL="http://192.168.1.100:8000"

# 3. Lancer le bridge
python3 mqtt-bridge.py
```

### Installation comme service systemd

```bash
# Copier le fichier service
sudo cp mqtt-bridge.service /etc/systemd/system/

# Éditer le fichier pour configurer les URLs
sudo nano /etc/systemd/system/mqtt-bridge.service

# Activer et démarrer le service
sudo systemctl enable mqtt-bridge
sudo systemctl start mqtt-bridge

# Voir les logs
sudo journalctl -u mqtt-bridge -f
```

## 🧪 Tests

### Test 1: Publier un événement manuellement

```bash
# Publier un mouvement détecté
mosquitto_pub -h localhost -t "sensors/raspberry-01/motion" \
  -m '{"confidence": 0.95, "location": "entrance"}'

# Publier une pression sur tapis
mosquitto_pub -h localhost -t "sensors/raspberry-01/button" \
  -m '{"pressure": "high", "duration_ms": 500}'
```

### Test 2: Écouter les événements MQTT

```bash
# Écouter tous les événements sensors
mosquitto_sub -h localhost -t "sensors/#" -v

# Écouter toutes les commandes
mosquitto_sub -h localhost -t "commands/#" -v
```

### Test 3: Envoyer une commande servomoteur

```bash
# Via MQTT directement
mosquitto_pub -h localhost -t "commands/raspberry-01/servo" \
  -m '{"direction": "left"}'

# Via le backend HTTP
curl -X POST http://localhost:8000/api/cameras/raspberry-01/servo \
  -H "Content-Type: application/json" \
  -d '{"direction": "left"}'
```

## 📊 Topics MQTT

### Format des topics

```
sensors/{device_id}/{sensor_type}
commands/{device_id}/{command_type}
```

### Topics des capteurs (Publish)

| Topic | Description | Payload exemple |
|-------|-------------|-----------------|
| `sensors/raspberry-01/motion` | Mouvement détecté | `{"confidence": 0.95, "location": "entrance"}` |
| `sensors/raspberry-01/button` | Pression tapis | `{"pressure": "high", "duration_ms": 500}` |
| `sensors/raspberry-02/motion` | Mouvement détecté | `{"confidence": 0.98, "location": "living"}` |

### Topics des commandes (Subscribe)

| Topic | Description | Payload exemple |
|-------|-------------|-----------------|
| `commands/raspberry-01/servo` | Contrôle servomoteur | `{"direction": "left"}` |
| `commands/raspberry-01/record` | Contrôle enregistrement | `{"action": "start"}` |

## 🔄 Flux complet d'un événement

### 1. Détection → MQTT

```python
# Sur Raspberry Pi - sensor-publisher.py
def on_pir_triggered():
    # Le capteur PIR détecte un mouvement
    mqtt_client.publish(
        'sensors/raspberry-01/motion',
        json.dumps({'confidence': 0.95})
    )
```

### 2. MQTT → Bridge → Backend

```python
# Sur le Bridge - mqtt-bridge.py
def on_message(client, userdata, message):
    # Reçoit le message MQTT
    payload = json.loads(message.payload)

    # Envoie au backend
    requests.post('http://backend:8000/api/events', json={
        'type': 'motion_detected',
        'device_id': 'raspberry-01',
        'details': payload
    })
```

### 3. Backend → WebSocket → Frontend

```javascript
// Backend - routes/events.js
router.post('/', (req, res) => {
    // Reçoit l'événement HTTP
    const event = req.body

    // Diffuse via WebSocket
    io.emit('motion_detected', event)
})

// Frontend - Dashboard.jsx
websocket.on('motion_detected', (data) => {
    // Affiche dans l'interface
    addEvent(data)
    if (mode === 'surveillance') {
        addAlert('Mouvement détecté!')
    }
})
```

## 🛡️ Modes de fonctionnement

### Mode 1: Tout local (sans backend)

```
Raspberry Pi → MQTT → Autres Raspberry Pi
✅ Fonctionne sans internet
✅ Latence minimale
❌ Pas d'interface web
❌ Pas d'historique
```

### Mode 2: Avec backend (recommandé)

```
Raspberry Pi → MQTT → Bridge → Backend → Frontend
✅ Interface web complète
✅ Historique des événements
✅ Notifications avancées
⚠️  Nécessite internet pour le frontend
```

### Mode 3: Hybride (meilleur des deux)

- MQTT pour les actions critiques locales
- Backend pour le monitoring et l'historique
- Si le backend tombe : MQTT continue

## 🔧 Configuration Mosquitto

Fichier `/etc/mosquitto/mosquitto.conf`:

```conf
# Port par défaut
listener 1883

# Autoriser les connexions anonymes (à sécuriser en prod)
allow_anonymous true

# Activer la persistence
persistence true
persistence_location /var/lib/mosquitto/

# Logs
log_dest file /var/log/mosquitto/mosquitto.log
log_type all
```

Redémarrer Mosquitto:
```bash
sudo systemctl restart mosquitto
```

## 📝 TODO

- [ ] Implémenter le contrôle GPIO réel dans sensor-publisher.py
- [ ] Ajouter l'authentification MQTT (username/password)
- [ ] Implémenter le contrôle servomoteur dans sensor-publisher.py
- [ ] Ajouter la gestion de l'enregistrement vidéo
- [ ] Créer des scripts de déploiement automatique
- [ ] Ajouter la persistence des événements (SQLite sur le Pi)
