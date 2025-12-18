# Frontend - Système de Surveillance

Interface web moderne pour visualiser les caméras et événements en temps réel.

## Technologies

- React 18
- Vite
- Tailwind CSS
- Socket.IO (WebSocket)
- HLS.js (streaming vidéo)
- Zustand (state management)
- React Router

## Fonctionnalités

- Visualisation temps réel de 2 caméras
- **Flux vidéo WebRTC** avec latence < 500ms via MediaMTX (protocole WHEP)
- Tableau de bord d'événements
- Alertes en temps réel (mouvement, pression tapis)
- Interface responsive
- Mode plein écran pour les caméras
- Captures d'écran
- Reconnexion automatique en cas de perte de connexion

## Streaming Vidéo WebRTC

Le frontend utilise **WebRTC** pour recevoir les flux vidéo depuis MediaMTX (serveur RTSP/WebRTC sur Kubernetes).

### Configuration requise

1. **Serveur MediaMTX** : Doit être accessible depuis le frontend
   ```env
   VITE_MEDIAMTX_URL=http://your-mediamtx-k8s-url:8889
   ```

2. **Streams disponibles** :
   - `raspberry-01` : Caméra 1
   - `raspberry-02` : Caméra 2

3. **Protocole** : WHEP (WebRTC HTTP Egress Protocol)
   - Endpoint : `${MEDIAMTX_URL}/${camera_id}/whep`
   - Méthode : POST avec SDP offer

Voir [docs/webrtc-streaming.md](../docs/webrtc-streaming.md) pour plus de détails.

## Installation

```bash
npm install
```

## Développement

```bash
# Copier le fichier d'environnement
cp .env.example .env

# Modifier les variables selon votre configuration
# VITE_API_URL=http://localhost:8000
# VITE_WS_URL=ws://localhost:8000
# VITE_MEDIAMTX_URL=http://your-mediamtx-server:8889

# Lancer le serveur de développement
npm run dev
```

L'application sera accessible sur http://localhost:3000

## Build Production

```bash
npm run build
```

Les fichiers de production seront dans le dossier `dist/`.

## Docker

```bash
# Build de l'image
docker build -t surveillance-frontend:latest .

# Run du conteneur
docker run -p 80:80 surveillance-frontend:latest
```

## Déploiement Kubernetes

```bash
# Appliquer la configuration
kubectl apply -f k8s/deployment.yaml

# Vérifier le déploiement
kubectl get pods -l app=surveillance-frontend

# Obtenir l'URL du service
kubectl get svc surveillance-frontend
```

## Structure du Projet

```
src/
├── components/          # Composants React
│   ├── CameraView.jsx   # Visualisation caméra
│   ├── EventsList.jsx   # Liste événements
│   ├── AlertPanel.jsx   # Panneau alertes
│   └── SystemStatus.jsx # État système
├── pages/
│   └── Dashboard.jsx    # Page principale
├── services/
│   ├── api.js           # API client
│   └── websocket.js     # WebSocket client
├── store/
│   └── useStore.js      # State management
├── App.jsx
├── main.jsx
└── index.css
```

## API Backend

Le frontend communique avec le backend via:

- **REST API**: `/api/*`
  - GET `/api/events` - Liste des événements
  - GET `/api/cameras/:id/stream` - Flux vidéo
  - GET `/api/cameras/:id/snapshot` - Capture

- **WebSocket**: `/ws`
  - Événements: `event`, `motion_detected`, `button_pressed`
  - État caméras: `camera_status`
  - Alertes: `alert`

## Personnalisation

### Ajouter une nouvelle caméra

Modifier `src/store/useStore.js`:

```javascript
cameras: [
  { id: 'raspberry-01', name: 'Caméra 1', status: 'offline', location: 'Entrée' },
  { id: 'raspberry-02', name: 'Caméra 2', status: 'offline', location: 'Salon' },
  { id: 'raspberry-03', name: 'Caméra 3', status: 'offline', location: 'Jardin' }, // Nouvelle
]
```

### Modifier les couleurs

Modifier `tailwind.config.js` pour changer le thème de couleurs.
