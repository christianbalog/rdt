# 🚀 Déploiement du Système de Surveillance

Guide complet pour déployer le système de surveillance avec MQTT local et backend cloud.

## 📋 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  LOCAL (Docker Compose)                                     │
│                                                             │
│  ┌──────────────┐     ┌─────────────────┐                 │
│  │  Mosquitto   │◄───►│  mqtt-bridge    │                 │
│  │  (MQTT)      │     │  (Python)       │                 │
│  └──────▲───────┘     └────────┬────────┘                 │
│         │                      │                           │
│    MQTT │                      │ HTTPS POST                │
│         │                      │                           │
│  ┌──────┴───────┐              │                           │
│  │ Raspberry Pi │              │                           │
│  │  Capteurs    │              │                           │
│  └──────────────┘              │                           │
└────────────────────────────────┼───────────────────────────┘
                                 │ Internet
                                 ▼
┌─────────────────────────────────────────────────────────────┐
│  CLOUD                                                      │
│  ┌────────────────┐         ┌────────────────┐            │
│  │  Backend       │ WebSocket│   Frontend     │            │
│  │  (Node.js)     │◄────────►│   (React)      │            │
│  │  Port 8000     │         │   Port 3000    │            │
│  └────────────────┘         └────────────────┘            │
└─────────────────────────────────────────────────────────────┘
```

## 🎯 Étape 1: Déployer le système local (MQTT + Bridge)

### Sur Raspberry Pi ou serveur local

```bash
# 1. Cloner le repository
git clone <votre-repo>
cd RDT

# 2. Configurer l'URL du backend cloud
cp .env.docker .env
nano .env

# Modifier cette ligne avec l'URL de votre backend cloud:
BACKEND_URL=https://votre-backend.com

# 3. Créer les dossiers nécessaires
mkdir -p mqtt-broker/data mqtt-broker/log

# 4. Démarrer les services
docker-compose up -d

# 5. Vérifier que tout fonctionne
docker-compose ps
docker-compose logs -f
```

### Vérification

```bash
# Tester que Mosquitto fonctionne
mosquitto_pub -h localhost -t "test" -m "hello"

# Voir les logs du bridge
docker-compose logs -f mqtt-bridge

# Tester l'envoi d'un événement
mosquitto_pub -h localhost \
  -t "sensors/raspberry-01/motion" \
  -m '{"confidence": 0.95}'

# Le bridge devrait envoyer au backend cloud !
```

## 🎯 Étape 2: Déployer le backend sur le cloud

### Option A: Déploiement sur un VPS (DigitalOcean, Linode, etc.)

```bash
# 1. Se connecter au VPS
ssh root@votre-serveur.com

# 2. Installer Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Cloner et installer le backend
git clone <votre-repo>
cd RDT/backend
npm install

# 4. Configurer les variables d'environnement
nano .env

# Contenu:
PORT=8000
CORS_ORIGIN=https://votre-frontend.com
MEDIAMTX_URL=http://mediamtx:8889

# 5. Installer PM2 pour la gestion des processus
npm install -g pm2

# 6. Lancer le backend
pm2 start src/server.js --name surveillance-backend
pm2 save
pm2 startup

# 7. Configurer Nginx comme reverse proxy
sudo apt install nginx

# /etc/nginx/sites-available/surveillance
server {
    listen 80;
    server_name votre-backend.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

# Activer le site
sudo ln -s /etc/nginx/sites-available/surveillance /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# 8. Installer SSL avec Let's Encrypt
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d votre-backend.com
```

### Option B: Déploiement sur Railway / Render / Heroku

**Railway.app (Recommandé - Gratuit au début):**

```bash
# 1. Installer Railway CLI
npm install -g @railway/cli

# 2. Se connecter
railway login

# 3. Initialiser le projet
cd backend
railway init

# 4. Configurer les variables d'environnement
railway variables set PORT=8000
railway variables set CORS_ORIGIN=https://votre-frontend.com

# 5. Déployer
railway up
```

### Option C: Docker sur le cloud

```yaml
# docker-compose.cloud.yml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - PORT=8000
      - CORS_ORIGIN=https://votre-frontend.com
    restart: unless-stopped
```

## 🎯 Étape 3: Déployer le frontend

### Option A: Vercel (Gratuit, Recommandé)

```bash
# 1. Installer Vercel CLI
npm install -g vercel

# 2. Se connecter
vercel login

# 3. Déployer
cd frontend
vercel

# 4. Configurer les variables d'environnement sur Vercel
# Via l'interface web ou CLI:
vercel env add VITE_API_URL
# Entrer: https://votre-backend.com

vercel env add VITE_WS_URL
# Entrer: wss://votre-backend.com
```

### Option B: Netlify

```bash
# 1. Build le frontend
cd frontend
npm run build

# 2. Déployer avec Netlify CLI
npm install -g netlify-cli
netlify deploy --prod --dir=dist

# 3. Configurer les variables d'environnement
# Via l'interface Netlify:
# VITE_API_URL=https://votre-backend.com
# VITE_WS_URL=wss://votre-backend.com
```

## 🎯 Étape 4: Configurer les Raspberry Pi

Sur chaque Raspberry Pi avec capteurs:

```bash
# 1. Installer les dépendances
sudo apt update
sudo apt install python3-pip python3-rpi.gpio

pip3 install paho-mqtt requests

# 2. Copier le script sensor-publisher.py
scp raspberry-services/sensor-publisher.py pi@raspberry-ip:/home/pi/

# 3. Configurer les variables d'environnement
nano ~/.bashrc

# Ajouter:
export MQTT_BROKER="192.168.1.100"  # IP du serveur avec docker-compose
export DEVICE_ID="raspberry-01"

source ~/.bashrc

# 4. Lancer le script
python3 sensor-publisher.py

# 5. Configurer pour démarrage automatique
sudo nano /etc/systemd/system/sensor-publisher.service

# Contenu:
[Unit]
Description=Sensor Publisher
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi
Environment="MQTT_BROKER=192.168.1.100"
Environment="DEVICE_ID=raspberry-01"
ExecStart=/usr/bin/python3 /home/pi/sensor-publisher.py
Restart=always

[Install]
WantedBy=multi-user.target

# Activer et démarrer
sudo systemctl enable sensor-publisher
sudo systemctl start sensor-publisher
sudo systemctl status sensor-publisher
```

## 🧪 Tests de bout en bout

### Test 1: Vérifier le flux complet

```bash
# 1. Sur Raspberry Pi ou via mosquitto_pub
mosquitto_pub -h <ip-docker-compose> \
  -t "sensors/raspberry-01/motion" \
  -m '{"confidence": 0.95}'

# 2. Vérifier les logs du bridge
docker-compose logs -f mqtt-bridge
# Devrait afficher: ✅ Événement envoyé au backend

# 3. Vérifier sur le backend cloud
curl https://votre-backend.com/api/events
# Devrait retourner l'événement

# 4. Vérifier sur le frontend
# Ouvrir https://votre-frontend.com
# L'événement devrait apparaître dans "Activité récente"
```

### Test 2: Vérifier la résilience

```bash
# 1. Arrêter le backend cloud
# (ou débrancher internet)

# 2. Publier un événement MQTT
mosquitto_pub -h localhost \
  -t "sensors/raspberry-01/motion" \
  -m '{"confidence": 0.95}'

# 3. Vérifier les logs du bridge
docker-compose logs mqtt-bridge
# Devrait afficher: ❌ Backend inaccessible
# Mais: → Le système local MQTT continue de fonctionner

# 4. Redémarrer le backend
# Les nouveaux événements seront envoyés
```

## 📊 Surveillance et Monitoring

### Logs en temps réel

```bash
# Tous les services
docker-compose logs -f

# Juste le bridge MQTT
docker-compose logs -f mqtt-bridge

# Backend cloud
pm2 logs surveillance-backend
```

### Health checks

```bash
# Backend cloud
curl https://votre-backend.com/health

# MQTT local
mosquitto_pub -h localhost -t "test" -m "ping"
```

## 🔒 Sécurité

### 1. Activer l'authentification MQTT

```bash
# Créer un fichier de mots de passe
docker-compose exec mosquitto mosquitto_passwd -c /mosquitto/config/passwd username

# Modifier mosquitto.conf
allow_anonymous false
password_file /mosquitto/config/passwd
```

### 2. Utiliser HTTPS pour le backend

- Let's Encrypt (gratuit)
- Cloudflare (gratuit avec tunnel)

### 3. Limiter l'accès à l'API

Ajouter une clé API dans les headers:

```javascript
// Backend
if (req.headers['x-api-key'] !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' })
}
```

## 🆘 Dépannage

### Le bridge n'envoie pas au backend

```bash
# Vérifier la connectivité
docker-compose exec mqtt-bridge ping -c 3 google.com

# Vérifier l'URL du backend
docker-compose exec mqtt-bridge env | grep BACKEND_URL

# Tester manuellement
docker-compose exec mqtt-bridge curl https://votre-backend.com/health
```

### MQTT ne reçoit pas les messages

```bash
# Vérifier que Mosquitto écoute
docker-compose exec mosquitto netstat -tulpn | grep 1883

# S'abonner pour tester
mosquitto_sub -h localhost -t "#" -v
```

### Le frontend ne reçoit pas les événements

1. Vérifier la configuration WebSocket
2. Ouvrir la console du navigateur
3. Vérifier CORS sur le backend

## 📝 Checklist de déploiement

- [ ] Docker-compose local démarré
- [ ] Mosquitto accessible (port 1883)
- [ ] mqtt-bridge envoie au backend cloud
- [ ] Backend cloud déployé et accessible
- [ ] Frontend déployé et accessible
- [ ] Variables d'environnement configurées
- [ ] SSL/HTTPS activé
- [ ] Raspberry Pi configurés et connectés
- [ ] Tests de bout en bout réussis
- [ ] Surveillance et logs configurés

## 🎉 Félicitations !

Votre système de surveillance est maintenant déployé avec:
- ✅ MQTT local pour la résilience
- ✅ Backend cloud pour le monitoring
- ✅ Frontend accessible partout
- ✅ Fonctionne même sans internet (en local)
