# 🚀 Quick Start Guide

Guide rapide pour démarrer le système complet.

## 📁 Structure requise

```
RDT/
├── docker-compose.yml           # ← Utiliser docker-compose.integrated.yml
├── .env                         # ← Configuration (déjà créé)
│
├── mosquitto/
│   └── config/
│       └── mosquitto.conf       # ← Déjà créé
│
├── sensor-motion/               # ← VOTRE CODE EXISTANT
│   ├── Dockerfile               # ← Votre Dockerfile balena
│   └── sensor_motion.py         # ← Votre script Python
│
└── mqtt-bridge/                 # ← NOUVEAU (déjà créé)
    ├── Dockerfile
    ├── mqtt-bridge.py
    └── requirements.txt
```

## 🎯 Installation - 3 étapes simples

### Étape 1: Copier le docker-compose

```bash
cd RDT

# Utiliser le docker-compose intégré
cp docker-compose.integrated.yml docker-compose.yml
```

### Étape 2: Vérifier la structure des dossiers

```bash
# Vérifier que vous avez:
ls -la

# Vous devriez voir:
# ✅ docker-compose.yml
# ✅ .env
# ✅ mosquitto/config/mosquitto.conf
# ✅ sensor-motion/Dockerfile
# ✅ sensor-motion/sensor_motion.py
# ✅ mqtt-bridge/Dockerfile
# ✅ mqtt-bridge/mqtt-bridge.py
```

### Étape 3: Démarrer les services

```bash
# Construire les images
docker-compose build

# Démarrer tous les services
docker-compose up -d

# Voir les logs
docker-compose logs -f
```

## ✅ Vérifier que tout fonctionne

### 1. Vérifier MQTT

```bash
# Voir les logs du broker
docker-compose logs mqtt-broker

# Devrait afficher:
# ✅ mosquitto version 2.x starting
```

### 2. Vérifier le capteur

```bash
# Voir les logs du capteur
docker-compose logs sensor-motion

# Devrait afficher:
# ✅ Connecté au broker MQTT!
# 👀 En attente de mouvement...
```

### 3. Vérifier le bridge

```bash
# Voir les logs du bridge
docker-compose logs mqtt-bridge

# Devrait afficher:
# ✅ Connecté au broker MQTT
# 📥 Abonné à: sensor/motion
# 📥 Abonné à: sensor/button
# etc.
```

### 4. Tester avec un événement simulé

```bash
# Publier un événement comme votre capteur le fait
docker-compose exec mqtt-broker mosquitto_pub \
  -t "sensor/motion" \
  -m '{
    "event_id": "test-123",
    "device_id": "raspberry-1",
    "source": "sensor-motion",
    "type": "MOTION_DETECTED",
    "data": {"presence": true, "gpio_pin": 17},
    "timestamp": 1734567890
  }'

# Voir les logs du bridge
docker-compose logs mqtt-bridge

# Devrait afficher:
# 📨 Message MQTT reçu:
#    Topic: sensor/motion
#    Payload: {...}
# ✅ Événement envoyé au backend: motion_detected
# (ou ❌ Backend inaccessible si le backend n'est pas encore démarré)
```

## 🌐 Démarrer le backend (local pour test)

```bash
# Dans un autre terminal
cd backend

# Installer les dépendances (si pas déjà fait)
npm install

# Démarrer le backend
npm run dev

# Le backend démarre sur http://localhost:8000
```

Maintenant, refaites le test ci-dessus, et vous devriez voir dans les logs du backend:

```
📥 Événement reçu depuis Raspberry: {
  type: 'motion_detected',
  device_id: 'raspberry-1',
  ...
}
```

## 🎨 Démarrer le frontend (local pour test)

```bash
# Dans un autre terminal
cd frontend

# Installer les dépendances (si pas déjà fait)
npm install

# Démarrer le frontend
npm run dev

# Le frontend démarre sur http://localhost:3000
```

Ouvrez votre navigateur sur http://localhost:3000, vous devriez voir:
- ✅ Les 2 caméras (sans flux pour l'instant)
- ✅ Le sélecteur de modes (Actif / Surveillance)
- ✅ La liste "Activité récente"

Quand vous déclenchez le capteur PIR, l'événement devrait apparaître en temps réel !

## 🔄 Workflow complet

```
Capteur PIR détecte
        ↓
sensor-motion publie sur MQTT
        ↓
mqtt-broker reçoit
        ↓
mqtt-bridge convertit et envoie
        ↓
Backend reçoit via POST
        ↓
Backend diffuse via WebSocket
        ↓
Frontend affiche en temps réel
```

## 🛑 Arrêter les services

```bash
# Arrêter tous les services Docker
docker-compose down

# Arrêter avec suppression des volumes
docker-compose down -v

# Arrêter le backend (Ctrl+C dans le terminal)
# Arrêter le frontend (Ctrl+C dans le terminal)
```

## 🧹 Redémarrer proprement

```bash
# Reconstruire toutes les images
docker-compose build --no-cache

# Redémarrer
docker-compose up -d

# Voir les logs
docker-compose logs -f
```

## 📝 Commandes utiles

```bash
# Voir les logs d'un service spécifique
docker-compose logs -f mqtt-bridge
docker-compose logs -f sensor-motion

# Voir le statut de tous les services
docker-compose ps

# Redémarrer un service spécifique
docker-compose restart mqtt-bridge

# Entrer dans un container
docker-compose exec mqtt-broker sh

# Publier un message MQTT manuellement
docker-compose exec mqtt-broker mosquitto_pub -t "sensor/motion" -m '{"test": true}'

# S'abonner à tous les topics MQTT
docker-compose exec mqtt-broker mosquitto_sub -t "#" -v
```

## ⚙️ Configuration

### Modifier l'URL du backend cloud

```bash
# Éditer le fichier .env
nano .env

# Modifier la ligne:
BACKEND_URL=https://votre-backend.com

# Redémarrer le bridge
docker-compose restart mqtt-bridge
```

## 🚀 Déploiement en production

Voir le fichier `DEPLOYMENT.md` pour le guide complet de déploiement sur le cloud.

## ❓ Problèmes courants

### Le bridge ne se connecte pas à MQTT

```bash
# Vérifier que mosquitto fonctionne
docker-compose ps

# Vérifier les logs
docker-compose logs mqtt-broker
```

### Le capteur ne détecte pas

```bash
# Vérifier les permissions GPIO
docker-compose logs sensor-motion

# Vérifier que /dev/gpiomem est accessible
ls -l /dev/gpiomem
```

### Le backend ne reçoit pas les événements

```bash
# Vérifier les logs du bridge
docker-compose logs mqtt-bridge

# Tester la connectivité
docker-compose exec mqtt-bridge curl http://localhost:8000/health
```

## 🎉 C'est tout !

Vous avez maintenant un système de surveillance complet qui fonctionne !

- ✅ Capteurs locaux avec MQTT
- ✅ Bridge qui envoie au cloud
- ✅ Backend avec WebSocket
- ✅ Frontend moderne avec React
- ✅ Fonctionne même sans internet (en local)
