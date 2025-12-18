# Streaming WebRTC avec MediaMTX

## Vue d'ensemble

Le système utilise **WebRTC** pour le streaming vidéo temps réel avec faible latence, via le serveur **MediaMTX** déjà déployé sur Kubernetes.

## Architecture du Flux Vidéo

```
┌─────────────────┐     RTSP      ┌──────────────────┐     WHEP/WebRTC    ┌──────────────┐
│  Raspberry Pi   │──────────────>│  MediaMTX        │<──────────────────>│   Frontend   │
│  (Caméra)       │               │  (Kubernetes)     │                    │   (Browser)  │
└─────────────────┘               └──────────────────┘                    └──────────────┘
```

### Flux de données

1. **Raspberry Pi → MediaMTX** : Flux RTSP depuis la caméra
   ```
   rtsp://mediamtx:8554/raspberry-01
   ```

2. **MediaMTX** : Conversion et exposition en plusieurs formats
   - RTSP (port 8554)
   - WebRTC via WHEP (port 8889)
   - HLS (optionnel)

3. **Frontend → MediaMTX** : Connexion WebRTC via protocole WHEP
   ```
   POST http://mediamtx:8889/raspberry-01/whep
   ```

## Protocol WHEP (WebRTC HTTP Egress Protocol)

WHEP est un standard pour recevoir des flux WebRTC via HTTP. C'est simple et efficace :

1. **Client crée une offre SDP**
   ```javascript
   const pc = new RTCPeerConnection()
   pc.addTransceiver('video', { direction: 'recvonly' })
   const offer = await pc.createOffer()
   await pc.setLocalDescription(offer)
   ```

2. **Envoie l'offre au serveur MediaMTX**
   ```javascript
   const response = await fetch(`${MEDIAMTX_URL}/raspberry-01/whep`, {
     method: 'POST',
     headers: { 'Content-Type': 'application/sdp' },
     body: offer.sdp,
   })
   ```

3. **Reçoit la réponse SDP du serveur**
   ```javascript
   const answerSdp = await response.text()
   await pc.setRemoteDescription(new RTCSessionDescription({
     type: 'answer',
     sdp: answerSdp,
   }))
   ```

4. **Flux vidéo commence**
   ```javascript
   pc.ontrack = (event) => {
     videoElement.srcObject = event.streams[0]
   }
   ```

## Configuration MediaMTX

Votre serveur MediaMTX doit avoir cette configuration (normalement déjà en place) :

```yaml
# mediamtx.yml
rtspAddress: :8554
webrtcAddress: :8889

# Activer WHEP
webrtcICEServers:
  - urls: [stun:stun.l.google.com:19302]

# Paths pour les caméras
paths:
  raspberry-01:
    source: publisher
  raspberry-02:
    source: publisher
```

## Configuration Frontend

Dans votre `.env` :

```env
# URL publique de votre serveur MediaMTX sur Kubernetes
VITE_MEDIAMTX_URL=http://your-k8s-mediamtx.example.com:8889

# Backend API
VITE_API_URL=http://your-k8s-backend.example.com:8000
VITE_WS_URL=ws://your-k8s-backend.example.com:8000
```

## Configuration Raspberry Pi

Les Raspberry Pi doivent publier leur flux RTSP vers MediaMTX :

```bash
# Avec ffmpeg
ffmpeg -f v4l2 -i /dev/video0 \
  -c:v libx264 -preset ultrafast -tune zerolatency \
  -f rtsp rtsp://mediamtx:8554/raspberry-01

# Ou avec GStreamer
gst-launch-1.0 v4l2src device=/dev/video0 ! \
  x264enc tune=zerolatency ! \
  rtspclientsink location=rtsp://mediamtx:8554/raspberry-01
```

## Avantages de WebRTC

1. **Faible latence** : < 500ms (vs 3-10s pour HLS)
2. **Natif navigateur** : Pas de bibliothèque externe
3. **Adaptatif** : Ajuste la qualité selon la bande passante
4. **P2P capable** : Peut réduire la charge serveur

## Gestion des Erreurs

Le composant `CameraViewWebRTC` gère automatiquement :

- **Reconnexion automatique** : En cas de perte de connexion
- **Timeout** : Détecte les connexions bloquées
- **États visuels** : Loading, connected, error
- **Fallback** : Possibilité d'ajouter un fallback HLS si WebRTC échoue

## Debugging

### Vérifier que MediaMTX reçoit le flux RTSP

```bash
# Depuis votre machine
ffplay rtsp://your-mediamtx-server:8554/raspberry-01
```

### Vérifier l'API WHEP

```bash
# Test de l'endpoint WHEP
curl -X OPTIONS http://your-mediamtx-server:8889/raspberry-01/whep
```

### Logs navigateur

Ouvrez la console du navigateur et cherchez :
- `WebRTC connecté avec succès`
- `Track reçu: video`
- `Connection state: connected`

### Logs MediaMTX

```bash
kubectl logs -f deployment/mediamtx
```

Vous devriez voir :
- `[RTSP] [conn] opened`
- `[WebRTC] [session] created`

## Performance

Configuration recommandée pour la caméra Raspberry Pi :

- **Résolution** : 1280x720 (720p) ou 1920x1080 (1080p)
- **FPS** : 30 (ou 15 pour économiser bande passante)
- **Codec** : H.264 (hardware sur Pi 4)
- **Bitrate** : 2000 kbps (720p) ou 4000 kbps (1080p)

## URLs de Référence

- MediaMTX documentation : https://github.com/bluenviron/mediamtx
- WHEP Protocol : https://datatracker.ietf.org/doc/draft-ietf-wish-whep/
- WebRTC API : https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API
