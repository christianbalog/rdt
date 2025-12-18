# 📹 Service de Capture Vidéo

Service qui enregistre automatiquement 10 secondes de vidéo quand le capteur PIR détecte un mouvement, et stocke les enregistrements dans une base SQLite locale.

## 🎯 Fonctionnalités

- ✅ Écoute les événements MQTT `sensor/motion`
- ✅ Enregistre 10 secondes de vidéo automatiquement
- ✅ Stocke les vidéos en BLOB dans SQLite
- ✅ API REST pour récupérer les vidéos
- ✅ Métadonnées associées à chaque enregistrement
- ✅ Fonctionne sans connexion cloud

## 📊 Architecture

```
Capteur PIR détecte
        ↓
Publie sur MQTT: sensor/motion
        ↓
capture-video reçoit l'événement
        ↓
Enregistre 10s avec libcamera-vid
        ↓
Convertit en blob
        ↓
Stocke dans SQLite (/data/recordings.db)
        ↓
Accessible via API REST
```

## 🚀 Utilisation

### Démarrer le service

```bash
# Avec docker-compose
docker-compose up -d capture-video

# Voir les logs
docker-compose logs -f capture-video
```

### Configuration (variables d'environnement)

```yaml
environment:
  - MQTT_BROKER=mqtt-broker          # Broker MQTT
  - MQTT_PORT=1883                   # Port MQTT
  - MQTT_TOPIC_MOTION=sensor/motion  # Topic à écouter
  - DEVICE_ID=raspberry-1            # ID du device
  - RECORD_DURATION=10               # Durée en secondes
  - VIDEO_WIDTH=1280                 # Largeur vidéo
  - VIDEO_HEIGHT=720                 # Hauteur vidéo
  - VIDEO_FPS=30                     # FPS
```

## 💾 Base de données SQLite

### Structure de la table `recordings`

```sql
CREATE TABLE recordings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT NOT NULL,              -- ID de l'événement qui a déclenché
    device_id TEXT NOT NULL,             -- ID du Raspberry Pi
    timestamp REAL NOT NULL,             -- Timestamp Unix
    duration INTEGER NOT NULL,           -- Durée en secondes
    video_blob BLOB NOT NULL,            -- Vidéo en blob
    video_size INTEGER NOT NULL,         -- Taille en bytes
    metadata TEXT,                       -- JSON avec métadonnées
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Accéder à la base directement

```bash
# Entrer dans le container
docker-compose exec capture-video sh

# Ouvrir SQLite
sqlite3 /data/recordings.db

# Requêtes utiles
SELECT COUNT(*) FROM recordings;
SELECT id, event_id, video_size, created_at FROM recordings LIMIT 10;
SELECT SUM(video_size) / 1024 / 1024 as total_mb FROM recordings;
```

## 🌐 API REST

Une API Flask est fournie pour récupérer les vidéos.

### Démarrer l'API

```bash
# Option 1: Dans le container capture-video
docker-compose exec capture-video python3 api_recordings.py

# Option 2: Ajouter un service dédié dans docker-compose
```

### Endpoints disponibles

#### GET /api/recordings
Liste tous les enregistrements (sans les blobs)

**Query params:**
- `device_id` - Filtrer par device
- `limit` - Nombre max de résultats (default: 50)
- `offset` - Pagination (default: 0)

**Réponse:**
```json
{
  "recordings": [
    {
      "id": 1,
      "event_id": "abc-123",
      "device_id": "raspberry-1",
      "timestamp": 1734567890.123,
      "duration": 10,
      "video_size": 2048576,
      "metadata": "{...}",
      "created_at": "2024-12-18 10:30:00",
      "video_url": "/api/recordings/1/video"
    }
  ],
  "count": 1,
  "limit": 50,
  "offset": 0
}
```

#### GET /api/recordings/:id
Récupère les détails d'un enregistrement

#### GET /api/recordings/:id/video
Télécharge la vidéo (blob)

**Réponse:** Fichier vidéo `.mp4`

#### DELETE /api/recordings/:id
Supprime un enregistrement

#### GET /api/recordings/stats
Statistiques sur les enregistrements

**Réponse:**
```json
{
  "total_recordings": 42,
  "total_size_bytes": 86016000,
  "total_size_mb": 82.03,
  "by_device": [
    {
      "device_id": "raspberry-1",
      "count": 42,
      "total_size": 86016000,
      "avg_size": 2048000
    }
  ]
}
```

## 🧪 Tests

### Test 1: Simuler un événement

```bash
# Publier un événement MQTT
docker-compose exec mqtt-broker mosquitto_pub \
  -t "sensor/motion" \
  -m '{
    "event_id": "test-123",
    "device_id": "raspberry-1",
    "source": "sensor-motion",
    "type": "MOTION_DETECTED",
    "data": {"presence": true},
    "timestamp": 1734567890
  }'

# Voir les logs du service capture
docker-compose logs -f capture-video

# Devrait afficher:
# 🚨 Mouvement détecté!
# 📹 Démarrage enregistrement vidéo...
# ✅ Enregistrement terminé
# ✅ Enregistrement sauvegardé dans la BD (ID: 1)
```

### Test 2: Vérifier la base de données

```bash
docker-compose exec capture-video sqlite3 /data/recordings.db \
  "SELECT id, event_id, video_size, created_at FROM recordings;"
```

### Test 3: Récupérer une vidéo

```bash
# Lancer l'API
docker-compose exec -d capture-video python3 api_recordings.py

# Lister les enregistrements
curl http://localhost:5000/api/recordings

# Télécharger une vidéo
curl http://localhost:5000/api/recordings/1/video -o video.mp4
```

## 📦 Taille des vidéos

Estimations (10 secondes):
- 1280x720 @ 30fps: ~2-3 MB
- 1920x1080 @ 30fps: ~4-5 MB
- 640x480 @ 15fps: ~1 MB

**Stockage requis:**
- 100 enregistrements: ~200-300 MB
- 1000 enregistrements: ~2-3 GB

## 🔧 Maintenance

### Nettoyer les anciens enregistrements

```bash
# Supprimer les enregistrements de plus de 7 jours
docker-compose exec capture-video sqlite3 /data/recordings.db \
  "DELETE FROM recordings WHERE created_at < datetime('now', '-7 days');"

# Optimiser la base
docker-compose exec capture-video sqlite3 /data/recordings.db "VACUUM;"
```

### Sauvegarder la base de données

```bash
# Copier la base localement
docker cp capture-video:/data/recordings.db ./backup-recordings.db

# Ou avec docker-compose
cp ./data/recordings/recordings.db ./backup-recordings.db
```

## 🚨 Dépannage

### Erreur: libcamera-vid non trouvé

```bash
# Vérifier que libcamera-apps est installé dans le container
docker-compose exec capture-video which libcamera-vid

# Si absent, reconstruire l'image
docker-compose build --no-cache capture-video
```

### Erreur: Impossible d'accéder à /dev/video0

```bash
# Vérifier que la caméra est détectée sur l'hôte
ls -l /dev/video*

# Vérifier que le container a accès
docker-compose exec capture-video ls -l /dev/video0
```

### Base de données verrouillée

```bash
# Arrêter le service
docker-compose stop capture-video

# Copier la base
cp ./data/recordings/recordings.db ./recordings-backup.db

# Redémarrer
docker-compose up -d capture-video
```

## 🎨 Intégration avec le frontend

Pour afficher les vidéos dans le frontend React, ajoutez une route au backend Node.js qui proxy l'API Flask:

```javascript
// backend/src/routes/recordings.js
router.get('/recordings', async (req, res) => {
    const response = await axios.get('http://capture-video:5000/api/recordings')
    res.json(response.data)
})

router.get('/recordings/:id/video', async (req, res) => {
    const response = await axios.get(
        `http://capture-video:5000/api/recordings/${req.params.id}/video`,
        { responseType: 'stream' }
    )
    response.data.pipe(res)
})
```

## 📝 Améliorations futures

- [ ] Compression vidéo (H.264 → H.265)
- [ ] Détection de mouvement dans la vidéo
- [ ] Thumbnails/preview
- [ ] Upload automatique vers le cloud
- [ ] Rotation automatique des anciens enregistrements
- [ ] Support multi-caméras
