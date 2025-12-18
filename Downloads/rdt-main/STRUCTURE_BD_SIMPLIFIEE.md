# Structure Simplifiée de la Base de Données - surveillance.db

## Vue d'ensemble

Base de données SQLite simplifiée pour le système de surveillance MQTT.

## Tables

### 1. Table: **capteur** (3 attributs)

```sql
CREATE TABLE capteur (
    id_capteur INTEGER PRIMARY KEY AUTOINCREMENT,
    nom_capteur TEXT NOT NULL,
    etat_capteur INTEGER NOT NULL DEFAULT 1 CHECK(etat_capteur IN (0, 1))
);
```

**Attributs:**
- `id_capteur` (PK) - Identifiant unique du capteur
- `nom_capteur` - Nom du capteur (ex: "PIR Entrée", "Tapis Salon", "Caméra 1")
- `etat_capteur` - État du capteur (0=inactif, 1=actif)

**Index:**
```sql
CREATE INDEX idx_capteur_etat ON capteur(etat_capteur);
```

**Données initiales:**
| id_capteur | nom_capteur | etat_capteur |
|------------|-------------|--------------|
| 1 | PIR Entrée | 1 |
| 2 | Tapis Salon | 1 |
| 3 | Bouton Arrêt | 1 |
| 4 | Caméra 1 | 1 |
| 5 | Caméra 2 | 1 |

---

### 2. Table: **evenement** (3 attributs)

```sql
CREATE TABLE evenement (
    id_evenement INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    id_capteur INTEGER NOT NULL,
    FOREIGN KEY (id_capteur) REFERENCES capteur(id_capteur) ON DELETE CASCADE
);
```

**Attributs:**
- `id_evenement` (PK) - Identifiant unique de l'événement
- `date` - Date et heure de l'événement (format ISO: "2025-12-18T17:30:00")
- `id_capteur` (FK) - Référence au capteur qui a déclenché l'événement

**Index:**
```sql
CREATE INDEX idx_evenement_capteur ON evenement(id_capteur);
CREATE INDEX idx_evenement_date ON evenement(date DESC);
```

---

### 3. Table: **media** (5 attributs)

```sql
CREATE TABLE media (
    id_media INTEGER PRIMARY KEY AUTOINCREMENT,
    video BLOB NOT NULL,
    date TEXT NOT NULL,
    id_capteur INTEGER NOT NULL,
    numero_camera INTEGER NOT NULL CHECK(numero_camera IN (1, 2)),
    FOREIGN KEY (id_capteur) REFERENCES capteur(id_capteur) ON DELETE CASCADE
);
```

**Attributs:**
- `id_media` (PK) - Identifiant unique du média
- `video` (BLOB) - Données binaires de la vidéo
- `date` - Date et heure de l'enregistrement (format ISO)
- `id_capteur` (FK) - Référence au capteur caméra
- `numero_camera` - Numéro de la caméra (1 ou 2)

**Index:**
```sql
CREATE INDEX idx_media_capteur ON media(id_capteur);
CREATE INDEX idx_media_date ON media(date DESC);
CREATE INDEX idx_media_camera ON media(numero_camera);
```

---

## Schéma Relationnel

```
┌─────────────────────┐
│     capteur         │
│---------------------|
│ id_capteur (PK)     │
│ nom_capteur         │
│ etat_capteur        │
└──────┬──────────────┘
       │ 1
       │
       │ N
┌──────▼──────────────┐
│    evenement        │
│---------------------|
│ id_evenement (PK)   │
│ date                │
│ id_capteur (FK)     │
└─────────────────────┘

┌─────────────────────┐
│      media          │
│---------------------|
│ id_media (PK)       │
│ video (BLOB)        │
│ date                │
│ id_capteur (FK)     │─────┐
│ numero_camera       │     │
└─────────────────────┘     │
          │                 │
          │ N               │ 1
          └─────────────────┘
           (retour capteur)
```

## Relations

1. **capteur → evenement** (1:N)
   - Un capteur peut générer plusieurs événements
   - CASCADE DELETE: Si capteur supprimé, ses événements sont supprimés

2. **capteur → media** (1:N)
   - Un capteur (caméra) peut générer plusieurs médias
   - CASCADE DELETE: Si capteur supprimé, ses médias sont supprimés

## Flux de Données - Exemple

### Détection de Mouvement → Enregistrement Vidéo

```
1. Capteur PIR détecte un mouvement
   ↓
2. Publication MQTT: sensors/raspberry-1/motion
   ↓
3. surveillance_service.py reçoit l'événement MQTT
   ↓
4. INSERT INTO evenement (date, id_capteur)
   VALUES ('2025-12-18T17:30:00', 1)
   → id_evenement = 42
   ↓
5. Capture vidéo (10 secondes, h264)
   ↓
6. INSERT INTO media (video, date, id_capteur, numero_camera)
   VALUES ([BLOB], '2025-12-18T17:30:00', 4, 1)
   → id_media = 15
```

## Requêtes SQL Utiles

### Lister les événements récents avec le capteur
```sql
SELECT
    e.id_evenement,
    e.date,
    c.nom_capteur,
    c.etat_capteur
FROM evenement e
JOIN capteur c ON e.id_capteur = c.id_capteur
ORDER BY e.date DESC
LIMIT 50;
```

### Lister les médias avec leur capteur
```sql
SELECT
    m.id_media,
    m.date,
    m.numero_camera,
    c.nom_capteur
FROM media m
JOIN capteur c ON m.id_capteur = c.id_capteur
ORDER BY m.date DESC;
```

### Statistiques par capteur
```sql
SELECT
    c.nom_capteur,
    COUNT(e.id_evenement) as nb_evenements
FROM capteur c
LEFT JOIN evenement e ON c.id_capteur = e.id_capteur
WHERE c.etat_capteur = 1
GROUP BY c.id_capteur;
```

### Statistiques par caméra
```sql
SELECT
    numero_camera,
    COUNT(*) as nb_videos
FROM media
GROUP BY numero_camera;
```

### Derniers événements avec média associé
```sql
SELECT
    e.id_evenement,
    e.date as date_evenement,
    c.nom_capteur,
    COUNT(m.id_media) as nb_videos
FROM evenement e
JOIN capteur c ON e.id_capteur = c.id_capteur
LEFT JOIN media m ON m.date = e.date
GROUP BY e.id_evenement
ORDER BY e.date DESC
LIMIT 10;
```

## API REST Endpoints

### GET /api/recordings
Liste tous les enregistrements vidéo

**Query params:**
- `numero_camera` - Filtrer par caméra (1 ou 2)
- `limit` - Nombre max de résultats (default: 50)
- `offset` - Pagination (default: 0)

**Réponse:**
```json
{
  "recordings": [
    {
      "id": 15,
      "date": "2025-12-18T17:30:00",
      "camera": 1,
      "sensor": "Caméra 1",
      "sensor_state": 1,
      "video_url": "/api/recordings/15/video"
    }
  ],
  "count": 1,
  "limit": 50,
  "offset": 0
}
```

### GET /api/recordings/{id}
Détails d'un enregistrement

### GET /api/recordings/{id}/video
Télécharger la vidéo (BLOB)

### DELETE /api/recordings/{id}
Supprimer un enregistrement

### GET /api/recordings/stats
Statistiques globales

**Réponse:**
```json
{
  "total_recordings": 125,
  "by_camera": [
    {"camera": 1, "count": 80},
    {"camera": 2, "count": 45}
  ],
  "by_sensor": [
    {"sensor": "Caméra 1", "count": 80},
    {"sensor": "Caméra 2", "count": 45}
  ]
}
```

## Mapping MQTT → Tables

### Événement Motion
```
Topic: sensor/motion
Payload: {"type": "MOTION_DETECTED", ...}
   ↓
evenement: (date, id_capteur=1)  # PIR Entrée
   ↓
media: (video, date, id_capteur=4, numero_camera=1)  # Caméra 1
```

### Événement Button
```
Topic: sensor/button
Payload: {"type": "BUTTON_PRESSED", ...}
   ↓
evenement: (date, id_capteur=3)  # Bouton Arrêt
```

### Événement Pressure
```
Topic: sensor/pressure
Payload: {"type": "PRESSURE_DETECTED", ...}
   ↓
evenement: (date, id_capteur=2)  # Tapis Salon
```

## Maintenance

### Vérifier l'intégrité
```sql
PRAGMA integrity_check;
```

### Compacter la base
```sql
VACUUM;
```

### Analyser pour optimiser
```sql
ANALYZE;
```

### Supprimer les événements de plus de 30 jours
```sql
DELETE FROM evenement
WHERE date < datetime('now', '-30 days');
```

### Supprimer les médias de plus de 7 jours
```sql
DELETE FROM media
WHERE date < datetime('now', '-7 days');
```

## Taille Estimée

Pour 1000 événements et 100 vidéos (10s chacune, ~500KB):
- Table capteur: ~1 KB
- Table evenement: ~50 KB
- Table media: ~50 MB (principalement les BLOBs)
- **Total: ~50 MB**

## Notes Importantes

1. **Pas de table configuration** - Configuration supprimée pour simplification
2. **Pas de métadonnées** - Suppression du champ metadata dans evenement
3. **Pas de timestamps Unix** - Utilisation uniquement de dates ISO
4. **Pas de types de capteur** - Identification par nom uniquement
5. **Pas de device_id** - Système mono-device
6. **BLOB storage** - Vidéos stockées directement en base (limité à quelques Go)
