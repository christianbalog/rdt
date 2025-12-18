# Intégration Raspberry Pi avec le Backend

Ce document explique comment les Raspberry Pi doivent envoyer les événements MQTT au backend.

## Architecture

```
┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│  Raspberry Pi    │         │  MQTT Broker     │         │     Backend      │
│                  │         │                  │         │   (Express)      │
│  - Capteur PIR   │ MQTT    │  - Mosquitto     │  HTTP   │                  │
│  - Capteur Tapis │ ───────>│  - Topics        │ ───────>│  POST /api/      │
│  - Caméra        │ Publish │                  │  POST   │      events      │
│  - Servomoteur   │         │                  │         │                  │
└──────────────────┘         └──────────────────┘         └──────────────────┘
                                                                     │
                                                                     │ WebSocket
                                                                     ▼
                                                          ┌──────────────────┐
                                                          │    Frontend      │
                                                          │     (React)      │
                                                          └──────────────────┘
```

## Configuration du Raspberry Pi

### 1. Variables d'environnement

Sur chaque Raspberry Pi, définir:

```bash
# URL du backend
BACKEND_URL="http://votre-backend-ip:8000"

# ID unique du Raspberry Pi
DEVICE_ID="raspberry-01"
```

### 2. Script Python pour envoyer les événements

```python
#!/usr/bin/env python3
import requests
import json
from datetime import datetime
import os

BACKEND_URL = os.getenv('BACKEND_URL', 'http://localhost:8000')
DEVICE_ID = os.getenv('DEVICE_ID', 'raspberry-01')

def send_event(event_type, details=None):
    """
    Envoie un événement au backend

    Args:
        event_type: 'motion_detected' ou 'button_pressed'
        details: Dictionnaire avec les détails de l'événement
    """
    payload = {
        'type': event_type,
        'device_id': DEVICE_ID,
        'details': details or {}
    }

    try:
        response = requests.post(
            f'{BACKEND_URL}/api/events',
            json=payload,
            timeout=5
        )

        if response.status_code == 201:
            print(f"✅ Événement envoyé: {event_type}")
            return True
        else:
            print(f"❌ Erreur: {response.status_code}")
            return False

    except Exception as e:
        print(f"❌ Erreur d'envoi: {e}")
        return False

# Exemple 1: Envoyer un événement de mouvement détecté
def on_motion_detected():
    send_event('motion_detected', {
        'confidence': 0.95,
        'location': 'entrance'
    })

# Exemple 2: Envoyer un événement de pression sur tapis
def on_button_pressed():
    send_event('button_pressed', {
        'pressure': 'high'
    })

# Exemple 3: Callback MQTT
def on_mqtt_message(client, userdata, message):
    """
    Callback appelé quand un message MQTT est reçu
    """
    topic = message.topic
    payload = json.loads(message.payload.decode())

    if topic == f'sensors/{DEVICE_ID}/motion':
        send_event('motion_detected', payload)

    elif topic == f'sensors/{DEVICE_ID}/button':
        send_event('button_pressed', payload)

if __name__ == '__main__':
    # Test d'envoi
    on_motion_detected()
```

## Types d'événements supportés

### 1. Motion Detected (Mouvement détecté)

Envoyé quand le capteur PIR détecte un mouvement.

```json
{
  "type": "motion_detected",
  "device_id": "raspberry-01",
  "details": {
    "confidence": 0.95,
    "location": "entrance"
  }
}
```

**Champs:**
- `type`: `"motion_detected"` (obligatoire)
- `device_id`: ID du Raspberry Pi (obligatoire)
- `details.confidence`: Niveau de confiance 0-1 (optionnel)
- `details.location`: Localisation du capteur (optionnel)

### 2. Button Pressed (Pression sur tapis)

Envoyé quand quelqu'un marche sur le tapis/capteur.

```json
{
  "type": "button_pressed",
  "device_id": "raspberry-02",
  "details": {
    "pressure": "high",
    "duration_ms": 500
  }
}
```

**Champs:**
- `type`: `"button_pressed"` (obligatoire)
- `device_id`: ID du Raspberry Pi (obligatoire)
- `details.pressure`: Niveau de pression (optionnel)
- `details.duration_ms`: Durée en millisecondes (optionnel)

## Réception des commandes depuis le Backend

Le Raspberry Pi doit exposer une API REST pour recevoir les commandes du backend.

### POST /api/servo

Contrôler le servomoteur de la caméra.

**Request:**
```json
{
  "direction": "left"
}
```

**Directions possibles:** `left`, `right`

**Response:**
```json
{
  "success": true,
  "current_angle": 45
}
```

**Exemple d'implémentation Flask:**

```python
from flask import Flask, request, jsonify
import RPi.GPIO as GPIO

app = Flask(__name__)

# Configuration du servomoteur
SERVO_PIN = 18
GPIO.setmode(GPIO.BCM)
GPIO.setup(SERVO_PIN, GPIO.OUT)
pwm = GPIO.PWM(SERVO_PIN, 50)  # 50 Hz
pwm.start(0)

current_angle = 90  # Position centrale

def set_servo_angle(angle):
    duty = angle / 18 + 2
    GPIO.output(SERVO_PIN, True)
    pwm.ChangeDutyCycle(duty)
    time.sleep(0.5)
    GPIO.output(SERVO_PIN, False)
    pwm.ChangeDutyCycle(0)

@app.route('/api/servo', methods=['POST'])
def control_servo():
    global current_angle

    data = request.json
    direction = data.get('direction')

    if direction == 'left':
        current_angle = max(0, current_angle - 15)
    elif direction == 'right':
        current_angle = min(180, current_angle + 15)
    else:
        return jsonify({'error': 'Direction invalide'}), 400

    set_servo_angle(current_angle)

    return jsonify({
        'success': True,
        'current_angle': current_angle
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
```

### GET /api/snapshot

Capturer une image de la caméra.

**Response:** Image JPEG

**Exemple d'implémentation:**

```python
from picamera import PiCamera
import io

@app.route('/api/snapshot', methods=['GET'])
def capture_snapshot():
    camera = PiCamera()
    stream = io.BytesIO()

    camera.capture(stream, format='jpeg')
    stream.seek(0)

    return send_file(
        stream,
        mimetype='image/jpeg',
        as_attachment=True,
        download_name='snapshot.jpg'
    )
```

## Streaming Vidéo avec MediaMTX

Les Raspberry Pi doivent streamer la vidéo vers MediaMTX via RTSP.

```bash
# Sur le Raspberry Pi
ffmpeg -f v4l2 -i /dev/video0 \
  -c:v libx264 -preset ultrafast -tune zerolatency \
  -b:v 1M -maxrate 1M -bufsize 2M \
  -f rtsp rtsp://mediamtx-server:8554/raspberry-01
```

Ou utiliser `libcamera-vid` (recommandé pour Raspberry Pi 4+):

```bash
libcamera-vid -t 0 --inline --width 1280 --height 720 \
  --framerate 30 --codec h264 \
  -o - | \
ffmpeg -i - -c:v copy -f rtsp rtsp://mediamtx-server:8554/raspberry-01
```

## Checklist de configuration

- [ ] Backend accessible depuis les Raspberry Pi
- [ ] Variables d'environnement configurées (`BACKEND_URL`, `DEVICE_ID`)
- [ ] Script Python pour envoyer les événements MQTT
- [ ] API Flask pour recevoir les commandes du backend
- [ ] Stream vidéo vers MediaMTX configuré
- [ ] Servomoteur connecté et testé
- [ ] Capteurs PIR et tapis configurés

## Tests

### Test d'envoi d'événement

```bash
# Depuis le Raspberry Pi
curl -X POST http://backend-ip:8000/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "type": "motion_detected",
    "device_id": "raspberry-01",
    "details": {"confidence": 0.95}
  }'
```

### Test de réception de commande servomoteur

```bash
# Depuis n'importe où
curl -X POST http://backend-ip:8000/api/cameras/raspberry-01/servo \
  -H "Content-Type: application/json" \
  -d '{"direction": "left"}'
```

## Dépannage

### Les événements ne sont pas reçus

1. Vérifier que le backend est accessible:
   ```bash
   curl http://backend-ip:8000/health
   ```

2. Vérifier les logs du Raspberry Pi

3. Vérifier la configuration du pare-feu

### Les commandes servomoteur ne fonctionnent pas

1. Vérifier que l'API Flask est démarrée sur le Raspberry Pi
2. Vérifier que le port 5000 est ouvert
3. Tester directement l'API du Raspberry Pi:
   ```bash
   curl -X POST http://raspberry-ip:5000/api/servo \
     -H "Content-Type: application/json" \
     -d '{"direction": "left"}'
   ```
