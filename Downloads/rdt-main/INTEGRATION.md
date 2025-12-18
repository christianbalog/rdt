# 🔗 Intégration avec votre système existant

Ce guide explique comment intégrer le backend cloud avec votre système de capteurs MQTT existant.

## 📋 Ce qui existe déjà

Vous avez déjà :
- ✅ Un capteur PIR avec code Python
- ✅ Un broker MQTT (Mosquitto)
- ✅ Un docker-compose fonctionnel
- ✅ Format d'événement structuré

**Format de vos événements MQTT :**
```json
{
  "event_id": "uuid",
  "device_id": "raspberry-1",
  "source": "sensor-motion",
  "type": "MOTION_DETECTED",
  "data": {
    "presence": true,
    "gpio_pin": 17
  },
  "timestamp": 1234567890
}
```

**Topic MQTT :** `sensor/motion`

## 🎯 Ce qu'on ajoute

On ajoute un service `mqtt-bridge` qui :
1. Écoute les événements MQTT locaux
2. Convertit le format pour le backend
3. Envoie au backend cloud via HTTPS POST

**Le système local continue de fonctionner même si le backend est down !**

## 🚀 Installation

### Étape 1: Ajouter le mqtt-bridge à votre docker-compose

```bash
# 1. Copier le docker-compose intégré
cp docker-compose.integrated.yml docker-compose.yml

# 2. Créer le fichier .env
cat > .env << EOF
BACKEND_URL=http://localhost:8000
# En production, mettez l'URL de votre backend cloud:
# BACKEND_URL=https://votre-backend.com
EOF

# 3. Créer les dossiers nécessaires si pas déjà fait
mkdir -p mosquitto/config mosquitto/data mosquitto/log
mkdir -p raspberry-services

# 4. Copier les fichiers du bridge
cp raspberry-services/mqtt-bridge.py raspberry-services/
cp raspberry-services/Dockerfile.bridge raspberry-services/
cp raspberry-services/requirements.txt raspberry-services/
```

### Étape 2: Démarrer les services

```bash
# Reconstruire les images (première fois ou après modification)
docker-compose build

# Démarrer tous les services
docker-compose up -d

# Voir les logs
docker-compose logs -f mqtt-bridge
```

### Étape 3: Tester

```bash
# Le capteur devrait publier automatiquement sur MQTT
# Vérifier les logs du bridge
docker-compose logs -f mqtt-bridge

# Vous devriez voir:
# 📨 Message MQTT reçu:
#    Topic: sensor/motion
#    Payload: {...}
# ✅ Événement envoyé au backend: motion_detected
```

## 📊 Flux de données complet

```
┌─────────────────────────────────────────────────────────────┐
│ LOCAL (Docker Compose sur Raspberry Pi)                     │
│                                                             │
│  ┌──────────────┐                                          │
│  │ Capteur PIR  │                                          │
│  │ (GPIO)       │                                          │
│  └──────┬───────┘                                          │
│         │                                                   │
│         │ Détection                                         │
│         ▼                                                   │
│  ┌──────────────────────────────────┐                     │
│  │  sensor-motion (votre code)      │                     │
│  │  - Lit GPIO                      │                     │
│  │  - Publie sur MQTT               │                     │
│  └──────┬───────────────────────────┘                     │
│         │ MQTT Publish                                     │
│         │ Topic: sensor/motion                             │
│         ▼                                                   │
│  ┌──────────────────────────────────┐                     │
│  │  mqtt-broker (Mosquitto)         │                     │
│  │  Port: 1883                      │                     │
│  └──────┬───────────────────────────┘                     │
│         │                                                   │
│         ├─→ [Autres abonnés locaux] ← Continuent de       │
│         │                              fonctionner         │
│         │                                                   │
│         │ MQTT Subscribe                                   │
│         ▼                                                   │
│  ┌──────────────────────────────────┐                     │
│  │  mqtt-bridge (Nouveau!)          │                     │
│  │  1. Reçoit événement MQTT        │                     │
│  │  2. Convertit le format          │                     │
│  │  3. POST vers backend cloud      │                     │
│  └──────┬───────────────────────────┘                     │
│         │                                                   │
└─────────┼───────────────────────────────────────────────────┘
          │ HTTPS POST
          │ /api/events
          ▼
┌─────────────────────────────────────────────────────────────┐
│  CLOUD (Backend Node.js)                                    │
│  https://votre-backend.com                                  │
│                                                             │
│  ┌──────────────────────────────────┐                     │
│  │  POST /api/events                │                     │
│  │  - Reçoit événement              │                     │
│  │  - Stocke en mémoire             │                     │
│  │  - Diffuse via WebSocket         │                     │
│  └──────┬───────────────────────────┘                     │
│         │ WebSocket                                        │
│         ▼                                                   │
│  ┌──────────────────────────────────┐                     │
│  │  Frontend (React)                │                     │
│  │  - Affiche événements            │                     │
│  │  - Mode surveillance/actif       │                     │
│  └──────────────────────────────────┘                     │
└─────────────────────────────────────────────────────────────┘
```

## 🔄 Format de conversion

Le `mqtt-bridge` convertit automatiquement votre format vers le format backend :

**Votre format MQTT :**
```json
{
  "event_id": "abc-123",
  "device_id": "raspberry-1",
  "source": "sensor-motion",
  "type": "MOTION_DETECTED",
  "data": {
    "presence": true,
    "gpio_pin": 17
  },
  "timestamp": 1734567890.123
}
```

**↓ Conversion automatique ↓**

**Format envoyé au backend :**
```json
{
  "type": "motion_detected",
  "device_id": "raspberry-1",
  "details": {
    "event_id": "abc-123",
    "source": "sensor-motion",
    "data": {
      "presence": true,
      "gpio_pin": 17
    },
    "original_timestamp": 1734567890.123,
    "mqtt_topic": "sensor/motion"
  }
}
```

## 🎨 Personnaliser pour d'autres capteurs

### Ajouter un capteur de pression (tapis)

**1. Créer le service dans docker-compose.yml :**

```yaml
sensor-pressure:
  build:
    context: ./sensor-pressure
    dockerfile: Dockerfile
  container_name: sensor-pressure
  privileged: true
  devices:
    - /dev/gpiomem:/dev/gpiomem
  environment:
    - MQTT_BROKER=mqtt-broker
    - MQTT_PORT=1883
    - MQTT_TOPIC=sensor/pressure
    - SENSOR_PIN=27
    - DEVICE_ID=raspberry-1
  depends_on:
    - mqtt-broker
  restart: unless-stopped
  networks:
    - surveillance-network
```

**2. Code Python du capteur (similaire au motion) :**

```python
# Dans le callback GPIO
event = {
    "event_id": str(uuid.uuid4()),
    "device_id": DEVICE_ID,
    "source": "sensor-pressure",
    "type": "PRESSURE_DETECTED",  # ← Le bridge le convertira en "button_pressed"
    "data": {
        "pressure": "high",
        "duration_ms": 500
    },
    "timestamp": time.time()
}
client.publish(MQTT_TOPIC, json.dumps(event), qos=1)
```

Le `mqtt-bridge` convertira automatiquement `PRESSURE_DETECTED` → `button_pressed` pour le backend.

## 🧪 Tests

### Test 1: Vérifier que le bridge reçoit les événements MQTT

```bash
# Voir les logs du bridge
docker-compose logs -f mqtt-bridge

# Déclencher le capteur PIR ou publier manuellement
docker-compose exec mqtt-broker mosquitto_pub \
  -t "sensor/motion" \
  -m '{
    "event_id": "test-123",
    "device_id": "raspberry-1",
    "source": "sensor-motion",
    "type": "MOTION_DETECTED",
    "data": {"presence": true},
    "timestamp": 1234567890
  }'

# Vous devriez voir dans les logs:
# 📨 Message MQTT reçu: ...
# ✅ Événement envoyé au backend: motion_detected
```

### Test 2: Vérifier que le backend reçoit

```bash
# Si le backend tourne localement
curl http://localhost:8000/api/events

# Devrait retourner les événements reçus
```

### Test 3: Tester la résilience (backend down)

```bash
# 1. Arrêter le backend
# (ou mettre une mauvaise URL dans .env)

# 2. Publier un événement
docker-compose exec mqtt-broker mosquitto_pub \
  -t "sensor/motion" \
  -m '{"type": "MOTION_DETECTED", ...}'

# 3. Voir les logs du bridge
docker-compose logs mqtt-bridge

# Devrait afficher:
# ❌ Backend inaccessible (ConnectionError)
#    → Le système local MQTT continue de fonctionner

# 4. Le système local continue de fonctionner normalement !
```

## 📝 Configuration avancée

### Variables d'environnement disponibles

**Pour mqtt-bridge :**
```env
MQTT_BROKER=mqtt-broker          # Hostname du broker MQTT
MQTT_PORT=1883                   # Port MQTT
MQTT_USERNAME=                   # Username MQTT (optionnel)
MQTT_PASSWORD=                   # Password MQTT (optionnel)
BACKEND_URL=http://localhost:8000  # URL du backend cloud
```

### Ajouter l'authentification MQTT

**1. Dans mosquitto.conf :**
```conf
allow_anonymous false
password_file /mosquitto/config/passwd
```

**2. Créer le fichier de mots de passe :**
```bash
docker-compose exec mqtt-broker mosquitto_passwd -c /mosquitto/config/passwd username
```

**3. Mettre à jour docker-compose.yml :**
```yaml
mqtt-bridge:
  environment:
    - MQTT_USERNAME=username
    - MQTT_PASSWORD=password
```

## 🚀 Déploiement en production

### 1. Backend sur le cloud

```bash
# Déployer le backend (Railway, Render, VPS, etc.)
# Obtenir l'URL: https://votre-backend.com
```

### 2. Mettre à jour .env

```bash
# Sur le Raspberry Pi
nano .env

# Modifier:
BACKEND_URL=https://votre-backend.com
```

### 3. Redémarrer le bridge

```bash
docker-compose restart mqtt-bridge
```

### 4. Vérifier

```bash
# Les événements devraient maintenant arriver sur le backend cloud
docker-compose logs -f mqtt-bridge
```

## 🛡️ Avantages de cette architecture

✅ **Résilience** : Le système local continue même si le backend est down
✅ **Pas de modification** : Votre code de capteur existant ne change pas
✅ **Flexible** : Facile d'ajouter d'autres abonnés MQTT
✅ **Découplé** : Le backend ne connaît pas MQTT
✅ **Scalable** : Ajoutez autant de capteurs que vous voulez

## ❓ FAQ

**Q: Mon code capteur existant va-t-il continuer de fonctionner ?**
R: Oui ! On ajoute juste un nouveau service qui écoute MQTT. Votre code ne change pas.

**Q: Que se passe-t-il si le backend est down ?**
R: Le bridge log l'erreur, mais MQTT continue de fonctionner localement. Tous vos abonnés locaux continuent de recevoir les événements.

**Q: Comment ajouter un nouveau type de capteur ?**
R: Créez un nouveau service dans docker-compose.yml avec votre code Python qui publie sur MQTT. Le bridge le détectera automatiquement.

**Q: Le bridge peut-il tourner sur un autre serveur ?**
R: Oui ! Le bridge peut tourner n'importe où tant qu'il a accès au broker MQTT et à internet.

**Q: Comment voir les événements en temps réel sur le frontend ?**
R: Ouvrez le frontend React, il affichera automatiquement les événements via WebSocket.
