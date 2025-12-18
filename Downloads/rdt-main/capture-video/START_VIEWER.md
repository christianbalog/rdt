# 🎬 Comment visualiser les vidéos

## Méthode 1: Interface Web (Recommandé)

### Sur le Raspberry Pi

```bash
# 1. Démarrer l'API
docker compose exec -d capture-video python3 api_recordings.py

# 2. Copier le fichier HTML sur le Raspberry Pi
# (ou créer le fichier directement avec nano)
nano ~/viewer.html
# Coller le contenu de web_viewer.html

# 3. Démarrer un serveur web simple
cd ~
python3 -m http.server 8080

# 4. Ouvrir dans un navigateur
# http://raspberry-ip:8080/viewer.html
```

### Depuis votre PC Windows

```bash
# 1. Créer un tunnel SSH pour l'API
ssh -L 5000:localhost:5000 id5@raspberrypi

# 2. Dans un autre terminal, tunnel pour le viewer
ssh -L 8080:localhost:8080 id5@raspberrypi

# 3. Ouvrir dans votre navigateur Windows
# http://localhost:8080/viewer.html
```

## Méthode 2: Télécharger et lire avec VLC

### Sur le Raspberry Pi

```bash
# 1. Démarrer l'API
docker compose exec -d capture-video python3 api_recordings.py

# 2. Télécharger une vidéo
curl http://localhost:5000/api/recordings/1/video -o video.mp4

# 3. Lire avec un lecteur
vlc video.mp4
# ou
mpv video.mp4
```

### Depuis Windows

```bash
# 1. SSH vers le Raspberry Pi et démarrer l'API
ssh id5@raspberrypi "cd ~/Téléchargements/projet/mqtt/sensor-motion && docker compose exec -d capture-video python3 api_recordings.py"

# 2. Créer un tunnel SSH
ssh -L 5000:localhost:5000 id5@raspberrypi

# 3. Télécharger depuis votre PC
curl http://localhost:5000/api/recordings/1/video -o video.mp4

# 4. Ouvrir avec VLC Windows
vlc video.mp4
```

## Méthode 3: Extraire directement depuis SQLite

```bash
# 1. Extraire la vidéo
docker compose exec capture-video sh -c \
  "sqlite3 /data/recordings.db \"SELECT writefile('/tmp/video.h264', video_blob) FROM recordings WHERE id=1;\""

# 2. Copier depuis le container
docker cp capture-video:/tmp/video.h264 ./video.h264

# 3. Lire
vlc video.h264
```

## Méthode 4: Partage Samba (Pour accès permanent)

### Sur le Raspberry Pi

```bash
# 1. Installer Samba
sudo apt install samba

# 2. Configurer le partage
sudo nano /etc/samba/smb.conf

# Ajouter à la fin:
[surveillance]
path = /home/id5/Téléchargements/projet/mqtt/sensor-motion/data/recordings
browseable = yes
read only = yes
guest ok = yes

# 3. Redémarrer Samba
sudo systemctl restart smbd

# 4. Depuis Windows
# Ouvrir l'explorateur de fichiers
# \\raspberrypi\surveillance
# Puis utiliser DB Browser for SQLite pour ouvrir recordings.db
```

## 🎯 Commandes rapides

### Lister toutes les vidéos disponibles

```bash
docker compose exec capture-video sqlite3 /data/recordings.db \
  "SELECT id, event_id, video_size, datetime(created_at) FROM recordings ORDER BY id DESC;"
```

### Télécharger la dernière vidéo

```bash
# Obtenir l'ID de la dernière vidéo
LAST_ID=$(docker compose exec -T capture-video sqlite3 /data/recordings.db \
  "SELECT id FROM recordings ORDER BY id DESC LIMIT 1;")

# Télécharger
curl http://localhost:5000/api/recordings/$LAST_ID/video -o last_video.mp4
```

### Télécharger toutes les vidéos

```bash
# Script pour télécharger toutes les vidéos
for id in $(docker compose exec -T capture-video sqlite3 /data/recordings.db \
  "SELECT id FROM recordings;"); do
    curl http://localhost:5000/api/recordings/$id/video -o "video_$id.mp4"
done
```

## 📱 Accès depuis smartphone

```bash
# 1. Démarrer l'API sur le Raspberry Pi
docker compose exec -d capture-video python3 api_recordings.py

# 2. Trouver l'IP du Raspberry Pi
hostname -I

# 3. Ouvrir sur le smartphone
# http://192.168.x.x:5000/api/recordings
# http://192.168.x.x:8080/viewer.html (si serveur web démarré)
```

## 🔒 Sécurité

Pour exposer l'API sur internet (avec précaution):

```bash
# Option 1: Tunnel Cloudflare (gratuit)
# https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/

# Option 2: Ngrok
ngrok http 5000
```

**⚠️ Attention:** N'exposez jamais directement sur internet sans authentification !
