#!/usr/bin/env python3
"""
Sensor Publisher - Publie les événements des capteurs sur MQTT
Ce script tourne sur chaque Raspberry Pi et détecte les événements des capteurs
"""

import paho.mqtt.client as mqtt
import json
import os
import time
from datetime import datetime

# Configuration
MQTT_BROKER = os.getenv('MQTT_BROKER', 'localhost')
MQTT_PORT = int(os.getenv('MQTT_PORT', '1883'))
DEVICE_ID = os.getenv('DEVICE_ID', 'raspberry-01')

# Topics MQTT
MOTION_TOPIC = f'sensors/{DEVICE_ID}/motion'
BUTTON_TOPIC = f'sensors/{DEVICE_ID}/button'
EVENT_TOPIC = f'sensors/{DEVICE_ID}/event'

print(f"""
╔════════════════════════════════════════════════════════════╗
║         Sensor Publisher - {DEVICE_ID:^23s}        ║
╚════════════════════════════════════════════════════════════╝

📡 MQTT Broker: {MQTT_BROKER}:{MQTT_PORT}
🔧 Device ID: {DEVICE_ID}
""")

# Client MQTT global
mqtt_client = None


def on_connect(client, userdata, flags, rc):
    """Callback appelé quand connecté au broker MQTT"""
    if rc == 0:
        print("✅ Connecté au broker MQTT")

        # S'abonner aux commandes pour ce device
        command_topic = f'commands/{DEVICE_ID}/#'
        client.subscribe(command_topic)
        print(f"📥 Abonné aux commandes: {command_topic}")
    else:
        print(f"❌ Échec de connexion MQTT, code: {rc}")


def on_message(client, userdata, message):
    """Callback pour recevoir les commandes (ex: contrôle servomoteur)"""
    topic = message.topic

    try:
        payload = json.loads(message.payload.decode())
        print(f"\n📨 Commande reçue:")
        print(f"   Topic: {topic}")
        print(f"   Payload: {payload}")

        # Traiter la commande
        if 'servo' in topic:
            handle_servo_command(payload)
        elif 'record' in topic:
            handle_record_command(payload)

    except Exception as e:
        print(f"❌ Erreur traitement commande: {e}")


def publish_motion_detected(confidence=0.95, location='unknown'):
    """
    Publie un événement de mouvement détecté sur MQTT

    Args:
        confidence: Niveau de confiance de la détection (0-1)
        location: Localisation du capteur
    """
    if not mqtt_client:
        print("❌ Client MQTT non initialisé")
        return False

    payload = {
        'confidence': confidence,
        'location': location,
        'timestamp': datetime.now().isoformat()
    }

    try:
        result = mqtt_client.publish(
            MOTION_TOPIC,
            json.dumps(payload),
            qos=1
        )

        if result.rc == mqtt.MQTT_ERR_SUCCESS:
            print(f"✅ Mouvement publié sur MQTT: {MOTION_TOPIC}")
            return True
        else:
            print(f"❌ Erreur publication MQTT: {result.rc}")
            return False

    except Exception as e:
        print(f"❌ Erreur: {e}")
        return False


def publish_button_pressed(pressure='medium', duration_ms=0):
    """
    Publie un événement de pression sur le tapis

    Args:
        pressure: Niveau de pression (low, medium, high)
        duration_ms: Durée de la pression en millisecondes
    """
    if not mqtt_client:
        print("❌ Client MQTT non initialisé")
        return False

    payload = {
        'pressure': pressure,
        'duration_ms': duration_ms,
        'timestamp': datetime.now().isoformat()
    }

    try:
        result = mqtt_client.publish(
            BUTTON_TOPIC,
            json.dumps(payload),
            qos=1
        )

        if result.rc == mqtt.MQTT_ERR_SUCCESS:
            print(f"✅ Pression publiée sur MQTT: {BUTTON_TOPIC}")
            return True
        else:
            print(f"❌ Erreur publication MQTT: {result.rc}")
            return False

    except Exception as e:
        print(f"❌ Erreur: {e}")
        return False


def handle_servo_command(payload):
    """
    Gère une commande de servomoteur

    Args:
        payload: {'direction': 'left' ou 'right'}
    """
    direction = payload.get('direction')
    print(f"🎮 Commande servomoteur: {direction}")

    # TODO: Implémenter le contrôle du servomoteur avec RPi.GPIO
    # Exemple:
    # if direction == 'left':
    #     servo.move_left()
    # elif direction == 'right':
    #     servo.move_right()


def handle_record_command(payload):
    """
    Gère une commande d'enregistrement

    Args:
        payload: {'action': 'start' ou 'stop'}
    """
    action = payload.get('action')
    print(f"⏺️  Commande enregistrement: {action}")

    # TODO: Implémenter le contrôle d'enregistrement


def setup_gpio_callbacks():
    """
    Configure les callbacks GPIO pour les capteurs
    À appeler une fois au démarrage
    """
    # TODO: Configurer RPi.GPIO
    # Exemple:
    # import RPi.GPIO as GPIO
    # GPIO.setmode(GPIO.BCM)
    #
    # # Capteur PIR
    # PIR_PIN = 17
    # GPIO.setup(PIR_PIN, GPIO.IN)
    # GPIO.add_event_detect(PIR_PIN, GPIO.RISING, callback=on_pir_triggered)
    #
    # # Capteur tapis (bouton)
    # BUTTON_PIN = 27
    # GPIO.setup(BUTTON_PIN, GPIO.IN, pull_up_down=GPIO.PUD_UP)
    # GPIO.add_event_detect(BUTTON_PIN, GPIO.FALLING, callback=on_button_pressed)

    print("⚠️  GPIO callbacks non configurés (TODO)")


def on_pir_triggered(channel):
    """Callback GPIO quand le capteur PIR détecte un mouvement"""
    publish_motion_detected(confidence=0.95, location='entrance')


def on_button_pressed_gpio(channel):
    """Callback GPIO quand le capteur de tapis détecte une pression"""
    publish_button_pressed(pressure='high', duration_ms=500)


def main():
    """Point d'entrée principal"""
    global mqtt_client

    # Créer le client MQTT
    mqtt_client = mqtt.Client(client_id=f'{DEVICE_ID}-publisher')
    mqtt_client.on_connect = on_connect
    mqtt_client.on_message = on_message

    # Connexion au broker
    try:
        print("🔌 Connexion au broker MQTT...")
        mqtt_client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)

        # Démarrer la boucle MQTT en arrière-plan
        mqtt_client.loop_start()

        # Configurer les callbacks GPIO
        setup_gpio_callbacks()

        print("\n✅ Système démarré - En attente d'événements...")
        print("   Appuyez sur Ctrl+C pour arrêter\n")

        # Mode TEST: Simuler des événements toutes les 10 secondes
        print("⚠️  MODE TEST: Simulation d'événements")
        while True:
            time.sleep(10)

            # Simuler un mouvement
            print("\n🧪 [TEST] Simulation mouvement...")
            publish_motion_detected(confidence=0.95, location='test')

            time.sleep(5)

            # Simuler une pression
            print("\n🧪 [TEST] Simulation pression tapis...")
            publish_button_pressed(pressure='high', duration_ms=500)

    except KeyboardInterrupt:
        print("\n⛔ Arrêt du service...")
        mqtt_client.loop_stop()
        mqtt_client.disconnect()

    except Exception as e:
        print(f"❌ Erreur: {e}")
        return 1

    return 0


if __name__ == '__main__':
    exit(main())
