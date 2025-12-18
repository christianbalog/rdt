#!/usr/bin/env python3
"""
MQTT Bridge - Pont entre MQTT et le Backend HTTP
Ce script écoute les événements MQTT et les envoie au backend via HTTP POST
Peut tourner sur un Raspberry Pi ou un serveur séparé
"""

import paho.mqtt.client as mqtt
import requests
import json
import os
import time
from datetime import datetime

# Configuration
MQTT_BROKER = os.getenv('MQTT_BROKER', 'localhost')
MQTT_PORT = int(os.getenv('MQTT_PORT', '1883'))
MQTT_USERNAME = os.getenv('MQTT_USERNAME', '')
MQTT_PASSWORD = os.getenv('MQTT_PASSWORD', '')

BACKEND_URL = os.getenv('BACKEND_URL', 'http://localhost:8000')

# Topics MQTT à écouter
TOPICS = [
    ('sensor/motion', 0),          # Format existant: sensor/motion
    ('sensor/button', 0),          # Format existant: sensor/button
    ('sensor/pressure', 0),        # Format existant: sensor/pressure
    ('sensors/+/motion', 0),       # Format alternatif: sensors/raspberry-01/motion
    ('sensors/+/button', 0),       # Format alternatif: sensors/raspberry-01/button
    ('sensors/+/event', 0),        # Format alternatif: sensors/raspberry-01/event
]

print(f"""
╔════════════════════════════════════════════════════════════╗
║         MQTT Bridge - Surveillance System                  ║
╚════════════════════════════════════════════════════════════╝

📡 MQTT Broker: {MQTT_BROKER}:{MQTT_PORT}
🌐 Backend URL: {BACKEND_URL}
📋 Topics surveillés:
""")
for topic, qos in TOPICS:
    print(f"   - {topic}")
print()


def send_to_backend(event_data):
    """
    Envoie l'événement au backend via HTTP POST
    Si le backend est inaccessible, log l'erreur mais continue
    """
    try:
        response = requests.post(
            f'{BACKEND_URL}/api/events',
            json=event_data,
            timeout=5
        )

        if response.status_code == 201:
            print(f"✅ Événement envoyé au backend: {event_data['type']}")
            return True
        else:
            print(f"⚠️  Backend a répondu avec le code: {response.status_code}")
            return False

    except requests.exceptions.ConnectionError:
        print(f"❌ Backend inaccessible (ConnectionError)")
        print(f"   → Le système local MQTT continue de fonctionner")
        return False

    except requests.exceptions.Timeout:
        print(f"❌ Backend timeout")
        return False

    except Exception as e:
        print(f"❌ Erreur d'envoi au backend: {e}")
        return False


def on_connect(client, userdata, flags, rc):
    """Callback appelé quand connecté au broker MQTT"""
    if rc == 0:
        print("✅ Connecté au broker MQTT")

        # S'abonner aux topics
        for topic, qos in TOPICS:
            client.subscribe(topic, qos)
            print(f"📥 Abonné à: {topic}")
    else:
        print(f"❌ Échec de connexion MQTT, code: {rc}")


def on_disconnect(client, userdata, rc):
    """Callback appelé quand déconnecté du broker MQTT"""
    print("⚠️  Déconnecté du broker MQTT")
    if rc != 0:
        print("   → Tentative de reconnexion...")


def on_message(client, userdata, message):
    """
    Callback appelé quand un message MQTT est reçu
    Parse le message et l'envoie au backend

    Supporte deux formats:
    1. Format existant (sensor/motion avec event_id, type, etc.)
    2. Format simple (sensors/device-id/motion)
    """
    topic = message.topic

    try:
        # Parser le payload JSON
        payload = json.loads(message.payload.decode())
    except json.JSONDecodeError:
        print(f"⚠️  Message non-JSON reçu sur {topic}")
        payload = {'raw': message.payload.decode()}

    print(f"\n📨 Message MQTT reçu:")
    print(f"   Topic: {topic}")
    print(f"   Payload: {json.dumps(payload, indent=2)}")

    # Détecter si c'est le format existant avec event_id
    if 'event_id' in payload and 'type' in payload:
        # Format existant: {event_id, device_id, source, type, data, timestamp}
        event_data = convert_existing_format(payload, topic)
    else:
        # Format simple: construire l'événement
        event_data = convert_simple_format(payload, topic)

    # Envoyer au backend (si disponible)
    send_to_backend(event_data)


def convert_existing_format(payload, topic):
    """
    Convertit le format existant vers le format backend

    Format existant:
    {
        "event_id": "uuid",
        "device_id": "raspberry-1",
        "source": "sensor-motion",
        "type": "MOTION_DETECTED",
        "data": {"presence": true, "gpio_pin": 17},
        "timestamp": 1234567890
    }

    Format backend:
    {
        "type": "motion_detected",
        "device_id": "raspberry-01",
        "details": {...}
    }
    """
    # Mapper les types d'événements
    type_mapping = {
        'MOTION_DETECTED': 'motion_detected',
        'BUTTON_PRESSED': 'button_pressed',
        'PRESSURE_DETECTED': 'button_pressed',
    }

    event_type = payload.get('type', 'event')
    backend_type = type_mapping.get(event_type, event_type.lower())

    event_data = {
        'type': backend_type,
        'device_id': payload.get('device_id', 'unknown'),
        'details': {
            'event_id': payload.get('event_id'),
            'source': payload.get('source'),
            'data': payload.get('data', {}),
            'original_timestamp': payload.get('timestamp'),
            'mqtt_topic': topic
        }
    }

    return event_data


def convert_simple_format(payload, topic):
    """
    Convertit un format simple vers le format backend
    """
    # Extraire le device_id du topic (ex: sensors/raspberry-01/motion)
    topic_parts = topic.split('/')
    if len(topic_parts) >= 2:
        device_id = topic_parts[1]
    else:
        device_id = 'unknown'

    # Déterminer le type d'événement
    if 'motion' in topic:
        event_type = 'motion_detected'
    elif 'button' in topic or 'pressure' in topic:
        event_type = 'button_pressed'
    else:
        event_type = 'event'

    event_data = {
        'type': event_type,
        'device_id': device_id,
        'details': {
            **payload,
            'mqtt_topic': topic
        }
    }

    return event_data


def main():
    """Point d'entrée principal"""

    # Créer le client MQTT
    client = mqtt.Client(client_id='mqtt-bridge')

    # Configuration des callbacks
    client.on_connect = on_connect
    client.on_disconnect = on_disconnect
    client.on_message = on_message

    # Authentification si nécessaire
    if MQTT_USERNAME and MQTT_PASSWORD:
        client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)

    # Connexion au broker
    try:
        print("🔌 Connexion au broker MQTT...")
        client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)

        # Boucle infinie pour écouter les messages
        client.loop_forever()

    except KeyboardInterrupt:
        print("\n⛔ Arrêt du bridge...")
        client.disconnect()

    except Exception as e:
        print(f"❌ Erreur: {e}")
        return 1

    return 0


if __name__ == '__main__':
    exit(main())
