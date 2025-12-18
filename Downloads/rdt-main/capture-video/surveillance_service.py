#!/usr/bin/env python3
"""
Service de Surveillance Complet
- Écoute les événements MQTT
- Enregistre les événements dans surveillance.db
- Capture vidéo sur détection
- Gère les notifications selon le mode
"""

import paho.mqtt.client as mqtt
import json
import os
import time
import subprocess
import sqlite3
from datetime import datetime
from pathlib import Path

# ============================================
# Configuration
# ============================================

MQTT_BROKER = os.getenv("MQTT_BROKER", "mqtt-broker")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))
MQTT_TOPIC_MOTION = os.getenv("MQTT_TOPIC_MOTION", "sensor/motion")
MQTT_TOPIC_BUTTON = os.getenv("MQTT_TOPIC_BUTTON", "sensor/button")
MQTT_TOPIC_PRESSURE = os.getenv("MQTT_TOPIC_PRESSURE", "sensor/pressure")

DEVICE_ID = os.getenv("DEVICE_ID", "raspberry-1")
RECORD_DURATION = int(os.getenv("RECORD_DURATION", 10))
VIDEO_WIDTH = int(os.getenv("VIDEO_WIDTH", 1280))
VIDEO_HEIGHT = int(os.getenv("VIDEO_HEIGHT", 720))
VIDEO_FPS = int(os.getenv("VIDEO_FPS", 30))

DB_PATH = "/data/surveillance.db"
TEMP_VIDEO_DIR = "/tmp/videos"

# Créer le dossier temporaire
Path(TEMP_VIDEO_DIR).mkdir(parents=True, exist_ok=True)

print(f"""
╔════════════════════════════════════════════════════════════╗
║         Service Surveillance - {DEVICE_ID:^23s}        ║
╚════════════════════════════════════════════════════════════╝

📡 MQTT Broker: {MQTT_BROKER}:{MQTT_PORT}
📹 Topics: {MQTT_TOPIC_MOTION}, {MQTT_TOPIC_BUTTON}, {MQTT_TOPIC_PRESSURE}
⏱️  Durée enregistrement: {RECORD_DURATION}s
💾 Base de données: {DB_PATH}
""")

# ============================================
# Base de données
# ============================================

def init_database():
    """Initialise la base de données avec le script SQL"""
    print("📊 Initialisation de la base de données...")

    # Lire et exécuter le script SQL
    script_path = os.path.join(os.path.dirname(__file__), 'init_surveillance_db.sql')

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Si le script existe, l'exécuter
    if os.path.exists(script_path):
        with open(script_path, 'r') as f:
            sql_script = f.read()
            cursor.executescript(sql_script)
    else:
        # Sinon, créer une structure minimale (nouvelle structure simplifiée)
        print("⚠️  Script SQL non trouvé, création structure minimale...")
        cursor.executescript("""
            -- Table: capteur (3 attributs)
            CREATE TABLE IF NOT EXISTS capteur (
                id_capteur INTEGER PRIMARY KEY AUTOINCREMENT,
                nom_capteur TEXT NOT NULL,
                etat_capteur INTEGER NOT NULL DEFAULT 1 CHECK(etat_capteur IN (0, 1))
            );

            CREATE INDEX IF NOT EXISTS idx_capteur_etat ON capteur(etat_capteur);

            -- Table: evenement (3 attributs)
            CREATE TABLE IF NOT EXISTS evenement (
                id_evenement INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                id_capteur INTEGER NOT NULL,
                FOREIGN KEY (id_capteur) REFERENCES capteur(id_capteur) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_evenement_capteur ON evenement(id_capteur);
            CREATE INDEX IF NOT EXISTS idx_evenement_date ON evenement(date DESC);

            -- Table: media (5 attributs)
            CREATE TABLE IF NOT EXISTS media (
                id_media INTEGER PRIMARY KEY AUTOINCREMENT,
                video BLOB NOT NULL,
                date TEXT NOT NULL,
                id_capteur INTEGER NOT NULL,
                numero_camera INTEGER NOT NULL CHECK(numero_camera IN (1, 2)),
                FOREIGN KEY (id_capteur) REFERENCES capteur(id_capteur) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_media_capteur ON media(id_capteur);
            CREATE INDEX IF NOT EXISTS idx_media_date ON media(date DESC);
            CREATE INDEX IF NOT EXISTS idx_media_camera ON media(numero_camera);

            -- Capteurs par défaut
            INSERT OR IGNORE INTO capteur (id_capteur, nom_capteur, etat_capteur) VALUES
            (1, 'PIR Entrée', 1),
            (2, 'Tapis Salon', 1),
            (3, 'Bouton Arrêt', 1),
            (4, 'Caméra 1', 1),
            (5, 'Caméra 2', 1);
        """)

    conn.commit()
    conn.close()
    print("✅ Base de données initialisée")


def get_capteur_id_by_name(nom_capteur):
    """Récupère l'ID du capteur par son nom"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id_capteur FROM capteur
        WHERE nom_capteur = ? AND etat_capteur = 1
        LIMIT 1
    """, (nom_capteur,))

    row = cursor.fetchone()
    conn.close()

    return row[0] if row else None


def save_evenement(nom_capteur):
    """
    Enregistre un événement dans la base de données

    Args:
        nom_capteur: Nom du capteur (ex: 'PIR Entrée')

    Returns:
        int: id_evenement
    """
    id_capteur = get_capteur_id_by_name(nom_capteur)

    if not id_capteur:
        print(f"⚠️  Capteur '{nom_capteur}' non trouvé dans la base")
        return None

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    now = datetime.now()

    cursor.execute("""
        INSERT INTO evenement (date, id_capteur)
        VALUES (?, ?)
    """, (now.isoformat(), id_capteur))

    id_evenement = cursor.lastrowid
    conn.commit()
    conn.close()

    return id_evenement


def save_media(video_data, id_capteur, numero_camera=1):
    """
    Enregistre un média (vidéo) dans la base de données

    Args:
        video_data: Données binaires de la vidéo (BLOB)
        id_capteur: ID du capteur caméra
        numero_camera: Numéro de la caméra (1 ou 2)

    Returns:
        int: id_media
    """
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    now = datetime.now()

    cursor.execute("""
        INSERT INTO media (video, date, id_capteur, numero_camera)
        VALUES (?, ?, ?, ?)
    """, (video_data, now.isoformat(), id_capteur, numero_camera))

    id_media = cursor.lastrowid
    conn.commit()
    conn.close()

    return id_media




# ============================================
# Capture vidéo
# ============================================

def record_video(event_id):
    """
    Enregistre une vidéo avec libcamera-vid, ffmpeg ou raspivid

    Returns:
        bytes: Données binaires de la vidéo
    """
    output_file = f"{TEMP_VIDEO_DIR}/recording_{event_id}_{int(time.time())}.h264"

    print(f"📹 Démarrage enregistrement vidéo...")
    print(f"   Fichier: {output_file}")
    print(f"   Durée: {RECORD_DURATION}s")

    try:
        # Méthode 1: libcamera-vid
        print(f"   Tentative avec libcamera-vid...")
        cmd = [
            "libcamera-vid",
            "-t", str(RECORD_DURATION * 1000),
            "--width", str(VIDEO_WIDTH),
            "--height", str(VIDEO_HEIGHT),
            "--framerate", str(VIDEO_FPS),
            "--codec", "h264",
            "-o", output_file,
            "--nopreview"
        ]

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=RECORD_DURATION + 5)

        if result.returncode == 0:
            print(f"   ✅ Capturé avec libcamera-vid")
        else:
            raise Exception("libcamera-vid failed")

    except (FileNotFoundError, Exception) as e:
        print(f"   ⚠️  libcamera-vid non disponible: {e}")

        try:
            # Méthode 2: ffmpeg
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
                "-y",
                output_file
            ]

            result = subprocess.run(cmd, capture_output=True, text=True, timeout=RECORD_DURATION + 5)

            if result.returncode == 0:
                print(f"   ✅ Capturé avec ffmpeg")
            else:
                raise Exception(f"ffmpeg failed: {result.stderr}")

        except (FileNotFoundError, Exception) as e2:
            print(f"   ⚠️  ffmpeg non disponible: {e2}")

            try:
                # Méthode 3: raspivid
                print(f"   Tentative avec raspivid...")
                cmd = [
                    "raspivid",
                    "-t", str(RECORD_DURATION * 1000),
                    "-w", str(VIDEO_WIDTH),
                    "-h", str(VIDEO_HEIGHT),
                    "-fps", str(VIDEO_FPS),
                    "-o", output_file,
                    "-n"
                ]

                result = subprocess.run(cmd, capture_output=True, text=True, timeout=RECORD_DURATION + 5)

                if result.returncode == 0:
                    print(f"   ✅ Capturé avec raspivid")
                else:
                    raise Exception(f"raspivid failed: {result.stderr}")

            except (FileNotFoundError, Exception) as e3:
                print(f"   ❌ Toutes les méthodes ont échoué")
                return None

    # Vérifier le fichier
    if not os.path.exists(output_file) or os.path.getsize(output_file) == 0:
        print(f"❌ Fichier vidéo invalide")
        if os.path.exists(output_file):
            os.remove(output_file)
        return None

    print(f"✅ Enregistrement terminé")

    # Lire le fichier
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
        client.subscribe(MQTT_TOPIC_BUTTON, qos=1)
        client.subscribe(MQTT_TOPIC_PRESSURE, qos=1)
        print(f"📥 Abonné aux topics")
    else:
        print(f"❌ Échec connexion MQTT: {rc}")


def on_message(client, userdata, message):
    """Callback MQTT - Traite les événements"""
    try:
        payload = json.loads(message.payload.decode())

        event_type = payload.get('type', '')
        event_id = payload.get('event_id', f'event_{int(time.time())}')
        device_id = payload.get('device_id', 'unknown')

        print(f"\n🚨 Événement reçu: {event_type}")
        print(f"   Event ID: {event_id}")
        print(f"   Topic: {message.topic}")

        # Déterminer le nom du capteur selon le type d'événement
        nom_capteur = None

        if event_type == 'MOTION_DETECTED':
            nom_capteur = 'PIR Entrée'
        elif event_type == 'BUTTON_PRESSED':
            nom_capteur = 'Bouton Arrêt' if 'button' in message.topic else 'Tapis Salon'
        elif event_type == 'PRESSURE_DETECTED':
            nom_capteur = 'Tapis Salon'

        if not nom_capteur:
            print(f"⚠️  Type d'événement non reconnu: {event_type}")
            return

        # Enregistrer l'événement
        id_evenement = save_evenement(nom_capteur)

        if not id_evenement:
            print(f"❌ Impossible d'enregistrer l'événement")
            return

        print(f"✅ Événement enregistré (ID: {id_evenement})")

        # Si c'est un mouvement, capturer la vidéo
        if event_type == 'MOTION_DETECTED':
            video_data = record_video(event_id)

            if video_data:
                id_capteur = get_capteur_id_by_name('Caméra 1')
                if id_capteur:
                    id_media = save_media(
                        video_data=video_data,
                        id_capteur=id_capteur,
                        numero_camera=1
                    )

                    print(f"✅ Vidéo enregistrée (ID: {id_media})")
                    print(f"   Taille: {len(video_data) / 1024:.2f} KB")
            else:
                print(f"❌ Échec capture vidéo")

    except json.JSONDecodeError:
        print(f"⚠️  Message MQTT non-JSON: {message.payload}")
    except Exception as e:
        print(f"❌ Erreur traitement: {e}")
        import traceback
        traceback.print_exc()


# ============================================
# Main
# ============================================

def main():
    """Point d'entrée principal"""

    # Initialiser la base de données
    init_database()

    # Créer le client MQTT
    client = mqtt.Client(client_id=f"surveillance-{DEVICE_ID}")
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

    print("\n✅ Service de surveillance démarré")
    print("👀 En attente d'événements...")
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
