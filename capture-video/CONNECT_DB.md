# 💾 Comment se connecter à la base de données SQLite

## 📍 Localisation de la base

La base de données est stockée dans:
```
./data/recordings/recordings.db
```

Sur le Raspberry Pi :
```
~/projet/mqtt/sensor-motion/data/recordings/recordings.db
```

Dans le container Docker:
```
/data/recordings.db
```

## 🔧 Méthodes de connexion

### Méthode 1: Depuis le container Docker

```bash
# Entrer dans le container
docker-compose exec capture-video sh

# Ouvrir SQLite
sqlite3 /data/recordings.db

# Commandes SQLite utiles:
.tables                                    # Lister les tables
.schema recordings                         # Voir la structure
SELECT COUNT(*) FROM recordings;          # Compter les enregistrements
SELECT * FROM recordings LIMIT 5;         # Voir les 5 premiers
.quit                                      # Quitter
```

### Méthode 2: Depuis le Raspberry Pi (hôte)

```bash
# Installer sqlite3 si pas déjà fait
sudo apt install sqlite3

# Se connecter à la base
cd ~/projet/mqtt/sensor-motion
sqlite3 ./data/recordings/recordings.db

# Ou en une commande
sqlite3 ./data/recordings/recordings.db "SELECT * FROM recordings;"
```

### Méthode 3: Avec un client graphique (depuis votre PC)

```bash
# 1. Copier la base depuis le Raspberry Pi vers votre PC
scp id5@raspberrypi:~/projet/mqtt/sensor-motion/data/recordings/recordings.db ./

# 2. Ouvrir avec DB Browser for SQLite
# Télécharger: https://sqlitebrowser.org/

# Ou avec DBeaver (gratuit)
# https://dbeaver.io/
```

### Méthode 4: Via Python (script)

```python
import sqlite3

# Se connecter
conn = sqlite3.connect('./data/recordings/recordings.db')
cursor = conn.cursor()

# Lister les enregistrements
cursor.execute("SELECT id, event_id, video_size, created_at FROM recordings")
for row in cursor.fetchall():
    print(row)

# Fermer
conn.close()
```

## 📊 Requêtes SQL utiles

### Voir tous les enregistrements (sans le blob)

```sql
SELECT
    id,
    event_id,
    device_id,
    timestamp,
    duration,
    video_size,
    created_at
FROM recordings
ORDER BY created_at DESC;
```

### Statistiques

```sql
-- Nombre total d'enregistrements
SELECT COUNT(*) as total FROM recordings;

-- Taille totale en MB
SELECT SUM(video_size) / 1024.0 / 1024.0 as total_mb FROM recordings;

-- Par device
SELECT
    device_id,
    COUNT(*) as count,
    SUM(video_size) / 1024.0 / 1024.0 as total_mb
FROM recordings
GROUP BY device_id;

-- Enregistrements récents (dernières 24h)
SELECT
    id,
    event_id,
    datetime(created_at) as date,
    video_size
FROM recordings
WHERE created_at >= datetime('now', '-1 day')
ORDER BY created_at DESC;
```

### Extraire une vidéo

```sql
-- Sauvegarder un blob dans un fichier
-- Note: Utiliser plutôt l'API REST pour ça
```

Depuis le shell:

```bash
# Extraire la vidéo ID 1
sqlite3 ./data/recordings/recordings.db \
  "SELECT video_blob FROM recordings WHERE id=1" \
  > video.h264

# Ou avec l'API
curl http://localhost:5000/api/recordings/1/video -o video.mp4
```

### Supprimer les anciens enregistrements

```sql
-- Supprimer les enregistrements de plus de 7 jours
DELETE FROM recordings
WHERE created_at < datetime('now', '-7 days');

-- Optimiser la base après suppression
VACUUM;
```

### Rechercher par event_id

```sql
SELECT * FROM recordings
WHERE event_id = 'abc-123';
```

## 🔐 Sauvegarder la base

```bash
# Méthode 1: Copie simple
cp ./data/recordings/recordings.db ./backup-$(date +%Y%m%d).db

# Méthode 2: Export SQL
sqlite3 ./data/recordings/recordings.db .dump > backup.sql

# Méthode 3: Depuis Docker
docker-compose exec capture-video sqlite3 /data/recordings.db .dump > backup.sql

# Restaurer depuis un backup SQL
sqlite3 ./data/recordings/recordings.db < backup.sql
```

## 📱 Accéder depuis l'extérieur

Si vous voulez accéder à la base depuis votre PC sur le réseau:

### Option 1: API REST (Recommandé)

```bash
# Sur le Raspberry Pi, démarrer l'API
docker-compose exec -d capture-video python3 api_recordings.py

# Depuis votre PC
curl http://raspberry-pi-ip:5000/api/recordings
curl http://raspberry-pi-ip:5000/api/recordings/1/video -o video.mp4
```

### Option 2: SSH Tunnel

```bash
# Depuis votre PC, créer un tunnel SSH
ssh -L 5000:localhost:5000 id5@raspberrypi

# Puis accéder à http://localhost:5000/api/recordings
```

### Option 3: Partage Samba/NFS

```bash
# Sur le Raspberry Pi, installer Samba
sudo apt install samba

# Partager le dossier data/recordings
# Puis accéder depuis Windows/Mac avec DB Browser
```

## 🛠️ Maintenance

### Vérifier l'intégrité

```bash
sqlite3 ./data/recordings/recordings.db "PRAGMA integrity_check;"
```

### Compacter la base

```bash
sqlite3 ./data/recordings/recordings.db "VACUUM;"
```

### Voir la taille

```bash
du -h ./data/recordings/recordings.db
```

## ⚠️ Attention

- La base peut devenir **très volumineuse** (chaque vidéo de 10s = ~2-3 MB)
- Penser à **nettoyer régulièrement** les anciens enregistrements
- **Sauvegarder** avant toute manipulation importante
- Ne **jamais modifier** directement les blobs dans la base
