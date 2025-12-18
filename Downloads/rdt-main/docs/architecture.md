# Architecture du Système de Surveillance

## Vue d'ensemble

Système de surveillance avec 2 caméras, capteurs et détection de mouvement, conçu pour fonctionner en mode offline avec synchronisation automatique.

## Architecture Globale

```
┌─────────────────────────────────────────────────────────────┐
│                     CLOUD (Kubernetes)                       │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  MQTT Broker │  │   Backend    │  │   Frontend   │      │
│  │  (Mosquitto) │  │   (FastAPI)  │  │    (React)   │      │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘      │
│         │                  │                                 │
│         │         ┌────────┴────────┐                       │
│         │         │  PostgreSQL DB  │                       │
│         │         └─────────────────┘                       │
└─────────┼──────────────────────────────────────────────────┘
          │
          │ Internet (MQTT over TLS)
          │
┌─────────┼──────────────────────────────────────────────────┐
│         │           RASPBERRY PI #1 (Docker Compose)        │
│         │                                                    │
│  ┌──────▼────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ MQTT Client   │  │Button Sensor │  │Photo Sensor  │    │
│  └───────────────┘  └──────┬───────┘  └──────┬───────┘    │
│                             │                  │             │
│  ┌───────────────┐  ┌──────▼──────────────────▼───┐       │
│  │Video Capture  │  │    Sync Service              │       │
│  │   (15s)       │  │  (Offline Queue)             │       │
│  └───────────────┘  └──────┬───────────────────────┘       │
│                             │                                │
│                      ┌──────▼────────┐                      │
│                      │  SQLite DB    │                      │
│                      └───────────────┘                      │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│         RASPBERRY PI #2 (Same Architecture)                  │
└──────────────────────────────────────────────────────────────┘
```

## Composants

### 1. Services Raspberry Pi (Local - Docker Compose)

#### Button Sensor Service
- Détecte pression sur le tapis
- Publie événement MQTT `sensors/button/pressed`
- Enregistre dans BD locale

#### Photo Sensor Service
- Détecte mouvement via capteur photo
- Publie événement MQTT `sensors/photo/motion`
- Enregistre dans BD locale

#### Video Capture Service
- Capture vidéo de 15s lors d'événements
- Envoie au serveur RTSP Kubernetes
- Stocke métadonnées en BD locale

#### Sync Service
- Queue offline des événements
- Synchronisation automatique au retour d'Internet
- Stratégie de retry exponentiel
- Détection de connectivité

#### MQTT Client
- Connexion au broker MQTT cloud
- Fallback mode si offline
- Buffer local des messages

#### Local Database (SQLite)
- Événements capteurs
- Métadonnées vidéos
- Queue de synchronisation
- État du système

### 2. Services Cloud (Kubernetes)

#### MQTT Broker (Mosquitto)
- Réception des événements de toutes les Raspberry Pi
- Topics:
  - `sensors/+/button/pressed`
  - `sensors/+/photo/motion`
  - `video/+/captured`
  - `system/+/status`

#### Backend (FastAPI)
- API REST pour le frontend
- Subscriber MQTT pour événements
- Endpoints:
  - `GET /api/events` - Liste des événements
  - `GET /api/cameras/{id}/stream` - Proxy RTSP
  - `GET /api/cameras/{id}/snapshots` - Images
  - `POST /api/events` - Sync depuis Raspberry
  - `WS /api/stream` - WebSocket temps réel

#### Frontend (React)
- Dashboard temps réel
- Visualisation caméras (HLS/WebRTC)
- Historique événements
- Alertes

#### PostgreSQL Database
- Événements tous capteurs
- Métadonnées vidéos
- Configuration système
- Utilisateurs

## Flux de Données

### 1. Détection Mouvement (Mode Online)
```
Bouton/Photo Sensor → MQTT Local → SQLite Local
                    ↓
                 MQTT Cloud → Backend → PostgreSQL
                    ↓
                 WebSocket → Frontend (Alerte temps réel)
```

### 2. Détection Mouvement (Mode Offline)
```
Bouton/Photo Sensor → SQLite Local (Queue)
                    ↓
          [Attend retour Internet]
                    ↓
           Sync Service → Backend API (POST /api/events)
                    ↓
                 PostgreSQL
```

### 3. Capture Vidéo
```
Event Trigger → Video Capture (15s)
              ↓
           RTSP Server (Kubernetes)
              ↓
           Metadata → Backend → PostgreSQL
```

## Technologies

### Raspberry Pi
- Python 3.11+
- Docker & Docker Compose
- SQLite 3
- Paho MQTT Client
- OpenCV (capture vidéo)
- RPi.GPIO (capteurs)

### Cloud (Kubernetes)
- FastAPI (Backend)
- React 18+ (Frontend)
- PostgreSQL 15
- Eclipse Mosquitto (MQTT)
- RTSP Server (existant)

## Sécurité

- MQTT over TLS (port 8883)
- Authentication JWT pour API
- Chiffrement BD locale
- VPN optionnel Raspberry ↔ Cloud

## Résilience

- Mode offline complet
- Queue locale persistante
- Retry automatique
- Health checks tous services
- Logs structurés

## Déploiement

### Raspberry Pi
```bash
cd raspberry-services
docker-compose up -d
```

### Cloud (Kubernetes)
```bash
kubectl apply -f mqtt-broker/k8s/
kubectl apply -f backend/k8s/
kubectl apply -f frontend/k8s/
```
