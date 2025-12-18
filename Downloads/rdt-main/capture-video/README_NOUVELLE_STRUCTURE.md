# 📊 Nouvelle Structure de Base de Données

## 🎯 Changements Principaux

Le système a été migré vers une **structure relationnelle complète** pour mieux gérer:
- Les capteurs multiples
- Les événements avec traçabilité
- Les médias (vidéos/photos) liés aux événements
- Les notifications selon le mode
- La configuration système

## 📁 Nouvelle Structure

### Base de données: `surveillance.db`

```
capteur
├── id_capteur (PK)
├── nom_capteur
├── type_capteur (motion, pressure, button, camera)
├── device_id
├── actif
└── date_creation

evenement
├── id_evenement (PK)
├── event_id (UUID MQTT)
├── date_evenement
├── timestamp
├── etat_capteur (0/1)
├── id_capteur (FK → capteur)
└── metadata (JSON)

media
├── id_media (PK)
├── type_media (video/photo)
├── video (BLOB)
├── taille
├── duree
├── date_media
├── timestamp
├── id_capteur (FK → capteur)
├── id_evenement (FK → evenement)
├── numero_camera (1 ou 2)
├── resolution
└── codec

notification
├── id_notification (PK)
├── id_evenement (FK → evenement)
├── mode (actif/surveillance)
├── envoyee (0/1)
├── date_notification
└── type_notification

configuration
├── cle (PK)
├── valeur
└── date_modification
```

## 🆕 Nouveaux Fichiers

| Fichier | Description |
|---------|-------------|
| `init_surveillance_db.sql` | Script SQL d'initialisation de la base |
| `surveillance_service.py` | Nouveau service principal (remplace capture_service.py) |
| `api_recordings.py` | API REST mise à jour pour la nouvelle structure |
| `database_structure_improved.json` | Documentation complète de la structure |

## 🚀 Migration depuis l'ancienne structure

### Option 1: Fresh Start (Recommandé)

```bash
# 1. Sauvegarder l'ancienne base si nécessaire
docker compose exec capture-video sqlite3 /data/recordings.db .dump > backup_old.sql

# 2. Supprimer l'ancien volume
docker compose down -v

# 3. Rebuild avec la nouvelle structure
docker compose build capture-video
docker compose up -d capture-video

# La nouvelle base sera automatiquement initialisée
```

### Option 2: Migration des données

```python
# Script Python pour migrer recordings.db → surveillance.db
import sqlite3

# Connexion aux deux bases
old_conn = sqlite3.connect('/data/recordings.db')
new_conn = sqlite3.connect('/data/surveillance.db')

# Initialiser la nouvelle structure
with open('init_surveillance_db.sql', 'r') as f:
    new_conn.executescript(f.read())

# Migrer les données
# 1. Obtenir l'ID du capteur caméra
cursor = new_conn.cursor()
cursor.execute("SELECT id_capteur FROM capteur WHERE type_capteur = 'camera' LIMIT 1")
id_camera = cursor.fetchone()[0]

cursor.execute("SELECT id_capteur FROM capteur WHERE type_capteur = 'motion' LIMIT 1")
id_motion = cursor.fetchone()[0]

# 2. Migrer les enregistrements
old_cursor = old_conn.cursor()
old_cursor.execute("SELECT * FROM recordings")

for row in old_cursor.fetchall():
    # Créer l'événement
    new_cursor = new_conn.cursor()
    new_cursor.execute("""
        INSERT INTO evenement (event_id, date_evenement, timestamp, etat_capteur, id_capteur, metadata)
        VALUES (?, ?, ?, 1, ?, ?)
    """, (row[1], row[8], row[3], id_motion, row[7]))
    id_evenement = new_cursor.lastrowid

    # Créer le média
    new_cursor.execute("""
        INSERT INTO media (type_media, video, taille, duree, date_media, timestamp,
                          id_capteur, id_evenement, numero_camera, resolution, codec)
        VALUES ('video', ?, ?, ?, ?, ?, ?, ?, 1, '1280x720', 'h264')
    """, (row[5], row[6], row[4], row[8], row[3], id_camera, id_evenement))

new_conn.commit()
old_conn.close()
new_conn.close()
```

## 📡 Utilisation de l'API

### Endpoints mis à jour

```bash
# Lister les médias (avec filtres)
GET /api/recordings?limit=50&type_media=video&numero_camera=1

# Détails d'un média
GET /api/recordings/1

# Télécharger la vidéo
GET /api/recordings/1/video

# Statistiques
GET /api/recordings/stats

# Supprimer
DELETE /api/recordings/1
```

### Exemple de réponse

```json
{
  "recordings": [
    {
      "id": 1,
      "type": "video",
      "size": 2457600,
      "duration": 10,
      "date": "2025-01-15T14:30:00",
      "camera": 1,
      "resolution": "1280x720",
      "codec": "h264",
      "event_id": "evt-123-abc",
      "sensor": "PIR Entrée",
      "sensor_type": "motion",
      "device_id": "raspberry-1",
      "video_url": "/api/recordings/1/video"
    }
  ],
  "count": 1
}
```

## 🔍 Requêtes SQL Utiles

### Événements récents avec médias

```sql
SELECT * FROM vue_evenements_recents LIMIT 10;
```

### Statistiques par capteur (dernières 24h)

```sql
SELECT
    c.nom_capteur,
    c.type_capteur,
    COUNT(e.id_evenement) as nb_evenements,
    COUNT(m.id_media) as nb_medias
FROM capteur c
LEFT JOIN evenement e ON c.id_capteur = e.id_capteur
    AND e.timestamp > strftime('%s', 'now') - 86400
LEFT JOIN media m ON e.id_evenement = m.id_evenement
WHERE c.actif = 1
GROUP BY c.id_capteur
ORDER BY nb_evenements DESC;
```

### Taille totale des médias par caméra

```sql
SELECT
    numero_camera,
    type_media,
    COUNT(*) as nombre,
    SUM(taille) / 1024.0 / 1024.0 as taille_mb
FROM media
GROUP BY numero_camera, type_media;
```

### Événements sans média capturé

```sql
SELECT
    e.id_evenement,
    e.event_id,
    e.date_evenement,
    c.nom_capteur
FROM evenement e
LEFT JOIN media m ON e.id_evenement = m.id_evenement
JOIN capteur c ON e.id_capteur = c.id_capteur
WHERE m.id_media IS NULL
AND c.type_capteur = 'motion'
ORDER BY e.timestamp DESC;
```

## 🎛️ Configuration Système

La table `configuration` permet de centraliser les paramètres:

```sql
-- Lire la configuration actuelle
SELECT * FROM configuration;

-- Changer le mode système
UPDATE configuration
SET valeur = 'surveillance', date_modification = datetime('now')
WHERE cle = 'mode_systeme';

-- Changer la durée d'enregistrement
UPDATE configuration
SET valeur = '15', date_modification = datetime('now')
WHERE cle = 'duree_enregistrement';
```

Ou via Python:

```python
from surveillance_service import get_config

mode = get_config('mode_systeme', default='actif')
duree = int(get_config('duree_enregistrement', default=10))
```

## 📊 Nouveautés par rapport à l'ancienne structure

### ✅ Avantages

1. **Relations claires**: Chaque média est lié à un événement et un capteur
2. **Traçabilité**: event_id permet de tracer de MQTT jusqu'à la BD
3. **Flexibilité**: Supporte plusieurs types de capteurs et médias
4. **Performance**: Index sur colonnes fréquemment utilisées
5. **Maintenance**: Trigger de purge automatique des anciens médias
6. **Configuration**: Paramètres centralisés dans la base
7. **Multi-device**: Support de plusieurs Raspberry Pi via device_id
8. **Extensible**: Facile d'ajouter de nouvelles colonnes ou tables

### 📈 Comparaison

| Fonctionnalité | Ancienne | Nouvelle |
|----------------|----------|----------|
| Tables | 1 (recordings) | 5 (capteur, evenement, media, notification, configuration) |
| Relations | Aucune | FK avec CASCADE |
| Types de capteurs | Implicite | Explicite (motion, pressure, button, camera) |
| Traçabilité MQTT | event_id seulement | event_id + metadata JSON |
| Index | 2 | 12 |
| Vues SQL | 0 | 1 (vue_evenements_recents) |
| Triggers | 0 | 1 (purge automatique) |
| Configuration | Variables env | Table configuration |

## 🔧 Commandes Docker

```bash
# Rebuild le service avec la nouvelle structure
docker compose build capture-video

# Démarrer
docker compose up -d capture-video

# Vérifier les logs
docker compose logs -f capture-video

# Accéder à la base de données
docker compose exec capture-video sqlite3 /data/surveillance.db

# Lancer l'API
docker compose exec -d capture-video python3 api_recordings.py

# Copier la base vers l'hôte
docker cp capture-video:/data/surveillance.db ./surveillance_backup.db
```

## 📝 TODO

- [ ] Script de migration automatique de recordings.db → surveillance.db
- [ ] Dashboard web pour visualiser les statistiques
- [ ] Endpoint API pour gérer la configuration
- [ ] Endpoint API pour lister/gérer les capteurs
- [ ] Notifications par email/SMS selon le mode
- [ ] Export des données en JSON/CSV
- [ ] Backup automatique programmé

## ❓ Questions Fréquentes

**Q: Que faire des anciennes vidéos dans recordings.db?**
R: Utilisez le script de migration Option 2 ou sauvegardez-les avec le script de backup.

**Q: Peut-on utiliser les deux structures en parallèle?**
R: Non recommandé. Choisissez une structure et migrez complètement.

**Q: Comment ajouter un nouveau capteur?**
R: INSERT INTO capteur (nom_capteur, type_capteur, device_id) VALUES ('Mon Capteur', 'motion', 'raspberry-1');

**Q: Comment désactiver un capteur sans le supprimer?**
R: UPDATE capteur SET actif = 0 WHERE id_capteur = 1;

**Q: La purge automatique supprime-t-elle aussi les événements?**
R: Non, seulement les médias > 30 jours. Pour changer: modifiez le trigger dans init_surveillance_db.sql

## 🎉 Conclusion

La nouvelle structure offre:
- 📊 Meilleure organisation des données
- 🔍 Traçabilité complète
- ⚡ Meilleures performances
- 🛠️ Plus facile à maintenir
- 📈 Plus facile à étendre

Bonne migration! 🚀
