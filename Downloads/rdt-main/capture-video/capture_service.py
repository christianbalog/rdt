#!/usr/bin/env python3
"""
Service de Capture Vidéo - S'active sur détection MQTT
Enregistre 10 secondes de vidéo et stocke en SQLite
"""

import paho.mqtt.client as mqtt
import json
import os
import time
import subprocess
import sqlite3
from datetime import datetime
from pathlib import Path

# Configuration
MQTT_BROKER = os.getenv("MQTT_BROKER", "mqtt-broker")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))
MQTT_TOPIC_MOTION = os.getenv("MQTT_TOPIC_MOTION", "sensor/motion")
DEVICE_ID = os.getenv("DEVICE_ID", "raspberry-1")
RECORD_DURATION = int(os.getenv("RECORD_DURATION", 10))  # secondes
VIDEO_WIDTH = int(os.getenv("VIDEO_WIDTH", 1280))
VIDEO_HEIGHT = int(os.getenv("VIDEO_HEIGHT", 720))
VIDEO_FPS = int(os.getenv("VIDEO_FPS", 30))

# Chemins
DB_PATH = "/data/recordings.db"
TEMP_VIDEO_DIR = "/tmp/videos"

# Créer le dossier temporaire
Path(TEMP_VIDEO_DIR).mkdir(parents=True, exist_ok=True)

print(f"""
╔════════════════════════════════════════════════════════════╗
║         Service Capture Vidéo - {DEVICE_ID:^23s}        ║
╚════════════════════════════════════════════════════════════╝

📡 MQTT Broker: {MQTT_BROKER}:{MQTT_PORT}
📹 Topic Motion: {MQTT_TOPIC_MOTION}
⏱️  Durée enregistrement: {RECORD_DURATION}s
💾 Base de données: {DB_PATH}
""")

# ============================================
# Base de données SQLite
# ============================================

def init_database():
    """Initialise la base de données SQLite"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS recordings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id TEXT NOT NULL,
            device_id TEXT NOT NULL,
            timestamp REAL NOT NULL,
            duration INTEGER NOT NULL,
            video_blob BLOB NOT NULL,
            video_size INTEGER NOT NULL,
            metadata TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Index pour les recherches
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_device_timestamp
        ON recordings(device_id, timestamp DESC)
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_event_id
        ON recordings(event_id)
    """)

    conn.commit()
    conn.close()
    print("✅ Base de données initialisée")


def save_recording_to_db(event_id, video_data, metadata):
    """
    Sauvegarde l'enregistrement dans SQLite

    Args:
        event_id: ID de l'événement qui a déclenché l'enregistrement
        video_data: Données binaires de la vidéo (blob)
        metadata: Métadonnées JSON
    """
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO recordings
        (event_id, device_id, timestamp, duration, video_blob, video_size, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        event_id,
        DEVICE_ID,
        time.time(),
        RECORD_DURATION,
        video_data,
        len(video_data),
        json.dumps(metadata)
    ))

    recording_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return recording_id


# ============================================
# Capture vidéo
# ============================================

def record_video(event_id):
    """
    Enregistre une vidéo de 10 secondes avec libcamera-vid

    Args:
        event_id: ID de l'événement MQTT

    Returns:
        bytes: Données binaires de la vidéo (blob)
    """
    output_file = f"{TEMP_VIDEO_DIR}/recording_{event_id}_{int(time.time())}.h264"

    print(f"📹 Démarrage enregistrement vidéo...")
    print(f"   Fichier: {output_file}")
    print(f"   Durée: {RECORD_DURATION}s")

    result = None

    try:
        # Méthode 1: Essayer libcamera-vid (Raspberry Pi OS moderne)
        print(f"   Tentative avec libcamera-vid...")
        cmd = [
            "libcamera-vid",
            "-t", str(RECORD_DURATION * 1000),  # milliseconds
            "--width", str(VIDEO_WIDTH),
            "--height", str(VIDEO_HEIGHT),
            "--framerate", str(VIDEO_FPS),
            "--codec", "h264",
            "-o", output_file,
            "--nopreview"
        ]

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=RECORD_DURATION + 5
        )

        if result.returncode == 0:
            print(f"   ✅ Capturé avec libcamera-vid")
        else:
            raise Exception("libcamera-vid failed")

    except (FileNotFoundError, Exception) as e:
        print(f"   ⚠️  libcamera-vid non disponible: {e}")

        try:
            # Méthode 2: Essayer ffmpeg avec v4l2 (plus universel)
            print(f"   Tentative avec ffmpeg...")
            cmd = [
                "ffmpeg",
                "-f", "v4l2",
                "-framerate", str(VIDEO_FPS),
                "-video_size", f"{VIDEO_WIDTH}x{VIDEO_HEIGHT}",
                "-i", "/dev/video0",
                "-t", str(RECORD_DURATION),
                "-c:v", "libx264",
                "-preset", "ultrafast",
                "-y",  # overwrite
                output_file
            ]

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=RECORD_DURATION + 5
            )

            if result.returncode == 0:
                print(f"   ✅ Capturé avec ffmpeg")
            else:
                raise Exception(f"ffmpeg failed: {result.stderr}")

        except (FileNotFoundError, Exception) as e2:
            print(f"   ⚠️  ffmpeg non disponible: {e2}")

            try:
                # Méthode 3: Essayer raspivid (Raspberry Pi ancien)
                print(f"   Tentative avec raspivid...")
                cmd = [
                    "raspivid",
                    "-t", str(RECORD_DURATION * 1000),
                    "-w", str(VIDEO_WIDTH),
                    "-h", str(VIDEO_HEIGHT),
                    "-fps", str(VIDEO_FPS),
                    "-o", output_file,
                    "-n"  # no preview
                ]

                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=RECORD_DURATION + 5
                )

                if result.returncode == 0:
                    print(f"   ✅ Capturé avec raspivid")
                else:
                    raise Exception(f"raspivid failed: {result.stderr}")

            except (FileNotFoundError, Exception) as e3:
                print(f"   ❌ Toutes les méthodes de capture ont échoué")
                print(f"      libcamera-vid: {e}")
                print(f"      ffmpeg: {e2}")
                print(f"      raspivid: {e3}")
                return None

    # Vérifier si le fichier a été créé et n'est pas vide
    if not os.path.exists(output_file):
        print(f"❌ Fichier vidéo non créé: {output_file}")
        return None

    if os.path.getsize(output_file) == 0:
        print(f"❌ Fichier vidéo vide: {output_file}")
        os.remove(output_file)
        return None

    print(f"✅ Enregistrement terminé")

    # Lire le fichier vidéo en mémoire
    with open(output_file, 'rb') as f:
        video_data = f.read()

    # Supprimer le fichier temporaire
    os.remove(output_file)

    print(f"💾 Vidéo capturée: {len(video_data)} bytes")

    return video_data


# ============================================
# MQTT Callbacks
# ============================================

def on_connect(client, userdata, flags, rc):
    """Callback MQTT connexion"""
    if rc == 0:
        print("✅ Connecté au broker MQTT")
        client.subscribe(MQTT_TOPIC_MOTION, qos=1)
        print(f"📥 Abonné à: {MQTT_TOPIC_MOTION}")
    else:
        print(f"❌ Échec connexion MQTT: {rc}")


def on_message(client, userdata, message):
    """
    Callback MQTT - Déclenché quand un mouvement est détecté
    """
    try:
        payload = json.loads(message.payload.decode())

        # Vérifier que c'est bien un événement de détection
        event_type = payload.get('type', '')
        if event_type != 'MOTION_DETECTED':
            return

        event_id = payload.get('event_id', f'event_{int(time.time())}')
        device_id = payload.get('device_id', 'unknown')

        print(f"\n🚨 Mouvement détecté!")
        print(f"   Event ID: {event_id}")
        print(f"   Device: {device_id}")

        # Démarrer l'enregistrement
        video_data = record_video(event_id)

        if video_data:
            # Métadonnées
            metadata = {
                'event_type': event_type,
                'device_id': device_id,
                'trigger_timestamp': payload.get('timestamp'),
                'video_resolution': f"{VIDEO_WIDTH}x{VIDEO_HEIGHT}",
                'video_fps': VIDEO_FPS,
                'video_codec': 'h264'
            }

            # Sauvegarder dans la base de données
            recording_id = save_recording_to_db(event_id, video_data, metadata)

            print(f"✅ Enregistrement sauvegardé dans la BD (ID: {recording_id})")
            print(f"   Taille: {len(video_data) / 1024:.2f} KB")
        else:
            print(f"❌ Échec de l'enregistrement")

    except json.JSONDecodeError:
        print(f"⚠️  Message MQTT non-JSON: {message.payload}")
    except Exception as e:
        print(f"❌ Erreur traitement message: {e}")


# ============================================
# Main
# ============================================

def main():
    """Point d'entrée principal"""

    # Initialiser la base de données
    init_database()

    # Créer le client MQTT
    client = mqtt.Client(client_id=f"capture-video-{DEVICE_ID}")
    client.on_connect = on_connect
    client.on_message = on_message

    # Connexion au broker avec retry
    max_retries = 10
    retry_delay = 5

    for attempt in range(max_retries):
        try:
            print(f"🔌 Connexion au broker MQTT... (tentative {attempt + 1}/{max_retries})")
            client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
            break
        except Exception as e:
            print(f"⚠️  Échec: {e}")
            if attempt < max_retries - 1:
                print(f"   Nouvelle tentative dans {retry_delay}s...")
                time.sleep(retry_delay)
            else:
                print("❌ Impossible de se connecter au broker MQTT")
                return 1

    print("\n✅ Service de capture vidéo démarré")
    print("👀 En attente de détections de mouvement...")
    print("   (Ctrl+C pour arrêter)\n")

    # Boucle principale
    try:
        client.loop_forever()
    except KeyboardInterrupt:
        print("\n⛔ Arrêt du service...")
        client.disconnect()
    except Exception as e:
        print(f"❌ Erreur: {e}")
        return 1

    return 0


if __name__ == '__main__':
    exit(main())
