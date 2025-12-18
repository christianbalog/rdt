#!/usr/bin/env python3
"""
Service de Synchronisation SQLite Local → Serveur Distant
Évite les doublons en comparant les IDs déjà synchronisés
Tourne sur Raspberry Pi
"""

import sqlite3
import requests
import json
import os
import time
from datetime import datetime
import schedule

# Configuration
LOCAL_DB_PATH = os.getenv("LOCAL_DB_PATH", "/data/surveillance.db")
BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:8000")
SYNC_INTERVAL_MINUTES = int(os.getenv("SYNC_INTERVAL_MINUTES", "5"))
DEVICE_ID = os.getenv("DEVICE_ID", "raspberry-1")

print(f"""
╔════════════════════════════════════════════════════════════╗
║         Service de Synchronisation - {DEVICE_ID:^17s}     ║
╚════════════════════════════════════════════════════════════╝

💾 Base de données locale: {LOCAL_DB_PATH}
🌐 Serveur distant: {BACKEND_URL}
⏱️  Intervalle de sync: {SYNC_INTERVAL_MINUTES} minutes
""")

# ============================================
# Table de Suivi des Synchronisations
# ============================================

def init_sync_tracking():
    """
    Crée une table pour suivre ce qui a déjà été synchronisé
    Évite les doublons
    """
    conn = sqlite3.connect(LOCAL_DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sync_tracking (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            table_name TEXT NOT NULL,
            local_id INTEGER NOT NULL,
            remote_id INTEGER,
            sync_date TEXT NOT NULL,
            sync_status TEXT NOT NULL CHECK(sync_status IN ('pending', 'success', 'failed')),
            error_message TEXT,
            UNIQUE(table_name, local_id)
        )
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_sync_status
        ON sync_tracking(sync_status, table_name)
    """)

    conn.commit()
    conn.close()
    print("✅ Table de suivi des synchronisations initialisée")


# ============================================
# Récupération des Données Non Synchronisées
# ============================================

def get_unsync_evenements():
    """
    Récupère les événements non encore synchronisés

    Returns:
        list: Liste de dictionnaires avec les données d'événements
    """
    conn = sqlite3.connect(LOCAL_DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            e.id_evenement,
            e.date,
            e.id_capteur,
            c.nom_capteur,
            c.etat_capteur
        FROM evenement e
        JOIN capteur c ON e.id_capteur = c.id_capteur
        WHERE e.id_evenement NOT IN (
            SELECT local_id
            FROM sync_tracking
            WHERE table_name = 'evenement'
            AND sync_status = 'success'
        )
        ORDER BY e.date ASC
    """)

    evenements = []
    for row in cursor.fetchall():
        evenements.append({
            'id_evenement': row['id_evenement'],
            'date': row['date'],
            'id_capteur': row['id_capteur'],
            'nom_capteur': row['nom_capteur'],
            'etat_capteur': row['etat_capteur']
        })

    conn.close()
    return evenements


def get_unsync_media():
    """
    Récupère les médias non encore synchronisés

    Returns:
        list: Liste de dictionnaires avec les données de médias
    """
    conn = sqlite3.connect(LOCAL_DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            m.id_media,
            m.video,
            m.date,
            m.id_capteur,
            m.numero_camera,
            c.nom_capteur
        FROM media m
        JOIN capteur c ON m.id_capteur = c.id_capteur
        WHERE m.id_media NOT IN (
            SELECT local_id
            FROM sync_tracking
            WHERE table_name = 'media'
            AND sync_status = 'success'
        )
        ORDER BY m.date ASC
    """)

    medias = []
    for row in cursor.fetchall():
        medias.append({
            'id_media': row['id_media'],
            'video': row['video'],
            'date': row['date'],
            'id_capteur': row['id_capteur'],
            'numero_camera': row['numero_camera'],
            'nom_capteur': row['nom_capteur']
        })

    conn.close()
    return medias


# ============================================
# Synchronisation vers le Serveur
# ============================================

def sync_evenement(evenement):
    """
    Synchronise un événement vers le serveur distant

    Args:
        evenement: Dictionnaire avec les données de l'événement

    Returns:
        dict: {'success': bool, 'remote_id': int, 'error': str}
    """
    try:
        # Préparer les données pour l'API
        payload = {
            'date': evenement['date'],
            'capteur': {
                'id': evenement['id_capteur'],
                'nom': evenement['nom_capteur'],
                'etat': evenement['etat_capteur']
            },
            'device_id': DEVICE_ID,
            'source': 'sync_service'
        }

        # Envoyer au serveur
        response = requests.post(
            f'{BACKEND_URL}/api/evenements',
            json=payload,
            timeout=10
        )

        if response.status_code == 201:
            remote_data = response.json()
            remote_id = remote_data.get('id')

            print(f"✅ Événement {evenement['id_evenement']} → Serveur (ID: {remote_id})")

            return {
                'success': True,
                'remote_id': remote_id,
                'error': None
            }
        else:
            error_msg = f"HTTP {response.status_code}: {response.text}"
            print(f"❌ Erreur sync événement {evenement['id_evenement']}: {error_msg}")

            return {
                'success': False,
                'remote_id': None,
                'error': error_msg
            }

    except requests.exceptions.ConnectionError:
        error_msg = "Serveur inaccessible"
        print(f"⚠️  {error_msg}")
        return {'success': False, 'remote_id': None, 'error': error_msg}

    except requests.exceptions.Timeout:
        error_msg = "Timeout"
        print(f"⚠️  Timeout événement {evenement['id_evenement']}")
        return {'success': False, 'remote_id': None, 'error': error_msg}

    except Exception as e:
        error_msg = str(e)
        print(f"❌ Exception: {error_msg}")
        return {'success': False, 'remote_id': None, 'error': error_msg}


def sync_media(media):
    """
    Synchronise un média (vidéo) vers le serveur distant

    Args:
        media: Dictionnaire avec les données du média

    Returns:
        dict: {'success': bool, 'remote_id': int, 'error': str}
    """
    try:
        # Préparer les données pour l'API
        # Option 1: Envoyer le BLOB en base64
        import base64
        video_base64 = base64.b64encode(media['video']).decode('utf-8')

        payload = {
            'date': media['date'],
            'capteur': {
                'id': media['id_capteur'],
                'nom': media['nom_capteur']
            },
            'numero_camera': media['numero_camera'],
            'video_data': video_base64,
            'device_id': DEVICE_ID,
            'source': 'sync_service'
        }

        # Envoyer au serveur
        response = requests.post(
            f'{BACKEND_URL}/api/media',
            json=payload,
            timeout=30  # Timeout plus long pour les vidéos
        )

        if response.status_code == 201:
            remote_data = response.json()
            remote_id = remote_data.get('id')

            taille_kb = len(media['video']) / 1024
            print(f"✅ Média {media['id_media']} → Serveur (ID: {remote_id}, {taille_kb:.2f} KB)")

            return {
                'success': True,
                'remote_id': remote_id,
                'error': None
            }
        else:
            error_msg = f"HTTP {response.status_code}: {response.text}"
            print(f"❌ Erreur sync média {media['id_media']}: {error_msg}")

            return {
                'success': False,
                'remote_id': None,
                'error': error_msg
            }

    except requests.exceptions.ConnectionError:
        error_msg = "Serveur inaccessible"
        print(f"⚠️  {error_msg}")
        return {'success': False, 'remote_id': None, 'error': error_msg}

    except requests.exceptions.Timeout:
        error_msg = "Timeout"
        print(f"⚠️  Timeout média {media['id_media']}")
        return {'success': False, 'remote_id': None, 'error': error_msg}

    except Exception as e:
        error_msg = str(e)
        print(f"❌ Exception: {error_msg}")
        return {'success': False, 'remote_id': None, 'error': error_msg}


# ============================================
# Enregistrement du Suivi
# ============================================

def mark_as_synced(table_name, local_id, remote_id, success, error_message=None):
    """
    Marque un enregistrement comme synchronisé

    Args:
        table_name: Nom de la table ('evenement' ou 'media')
        local_id: ID local de l'enregistrement
        remote_id: ID distant retourné par le serveur
        success: True si succès, False sinon
        error_message: Message d'erreur si échec
    """
    conn = sqlite3.connect(LOCAL_DB_PATH)
    cursor = conn.cursor()

    sync_status = 'success' if success else 'failed'

    cursor.execute("""
        INSERT OR REPLACE INTO sync_tracking
        (table_name, local_id, remote_id, sync_date, sync_status, error_message)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (
        table_name,
        local_id,
        remote_id,
        datetime.now().isoformat(),
        sync_status,
        error_message
    ))

    conn.commit()
    conn.close()


# ============================================
# Processus de Synchronisation Principal
# ============================================

def synchronize():
    """
    Fonction principale de synchronisation
    Synchronise tous les événements et médias non synchronisés
    """
    print(f"\n🔄 Début de synchronisation - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    # Statistiques
    stats = {
        'evenements_synced': 0,
        'evenements_failed': 0,
        'media_synced': 0,
        'media_failed': 0
    }

    # 1. Synchroniser les événements
    print("\n📋 Synchronisation des événements...")
    evenements = get_unsync_evenements()

    if evenements:
        print(f"   {len(evenements)} événement(s) à synchroniser")

        for evt in evenements:
            result = sync_evenement(evt)

            if result['success']:
                mark_as_synced('evenement', evt['id_evenement'], result['remote_id'], True)
                stats['evenements_synced'] += 1
            else:
                mark_as_synced('evenement', evt['id_evenement'], None, False, result['error'])
                stats['evenements_failed'] += 1

            # Petite pause entre les requêtes
            time.sleep(0.1)
    else:
        print("   ✅ Tous les événements sont déjà synchronisés")

    # 2. Synchroniser les médias
    print("\n📹 Synchronisation des médias...")
    medias = get_unsync_media()

    if medias:
        print(f"   {len(medias)} média(s) à synchroniser")

        for media in medias:
            result = sync_media(media)

            if result['success']:
                mark_as_synced('media', media['id_media'], result['remote_id'], True)
                stats['media_synced'] += 1
            else:
                mark_as_synced('media', media['id_media'], None, False, result['error'])
                stats['media_failed'] += 1

            # Pause plus longue pour les médias (vidéos lourdes)
            time.sleep(0.5)
    else:
        print("   ✅ Tous les médias sont déjà synchronisés")

    # Afficher les statistiques
    print(f"""
╔════════════════════════════════════════════════════════════╗
║                  Rapport de Synchronisation                ║
╠════════════════════════════════════════════════════════════╣
║  Événements synchronisés : {stats['evenements_synced']:3d}                          ║
║  Événements échoués      : {stats['evenements_failed']:3d}                          ║
║  Médias synchronisés     : {stats['media_synced']:3d}                          ║
║  Médias échoués          : {stats['media_failed']:3d}                          ║
╚════════════════════════════════════════════════════════════╝
    """)

    return stats


def retry_failed_syncs():
    """
    Retente la synchronisation des enregistrements échoués
    """
    print("\n🔁 Nouvelle tentative pour les synchronisations échouées...")

    conn = sqlite3.connect(LOCAL_DB_PATH)
    cursor = conn.cursor()

    # Marquer les échecs comme 'pending' pour les réessayer
    cursor.execute("""
        UPDATE sync_tracking
        SET sync_status = 'pending'
        WHERE sync_status = 'failed'
    """)

    updated = cursor.rowcount
    conn.commit()
    conn.close()

    if updated > 0:
        print(f"   {updated} enregistrement(s) marqué(s) pour nouvelle tentative")
        synchronize()
    else:
        print("   ✅ Aucun échec à réessayer")


# ============================================
# Commandes Utiles
# ============================================

def show_sync_stats():
    """
    Affiche les statistiques de synchronisation
    """
    conn = sqlite3.connect(LOCAL_DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            table_name,
            sync_status,
            COUNT(*) as count
        FROM sync_tracking
        GROUP BY table_name, sync_status
    """)

    print("\n📊 Statistiques de synchronisation:")
    for row in cursor.fetchall():
        print(f"   {row[0]:12s} - {row[1]:8s}: {row[2]:4d}")

    conn.close()


def reset_sync_tracking():
    """
    Réinitialise le suivi de synchronisation (ATTENTION: Tout resynchroniser)
    """
    conn = sqlite3.connect(LOCAL_DB_PATH)
    cursor = conn.cursor()

    cursor.execute("DELETE FROM sync_tracking")

    deleted = cursor.rowcount
    conn.commit()
    conn.close()

    print(f"⚠️  {deleted} enregistrement(s) de suivi supprimé(s)")
    print("   → Prochaine sync resynchronisera TOUT")


# ============================================
# Main
# ============================================

def main():
    """Point d'entrée principal"""

    # Initialiser la table de suivi
    init_sync_tracking()

    # Mode de fonctionnement
    mode = os.getenv("SYNC_MODE", "periodic")  # periodic, once, continuous

    if mode == "once":
        # Synchronisation unique
        print("🔄 Mode: Synchronisation unique")
        synchronize()
        show_sync_stats()

    elif mode == "continuous":
        # Synchronisation continue (toutes les X minutes)
        print(f"🔄 Mode: Synchronisation continue (toutes les {SYNC_INTERVAL_MINUTES} min)")

        # Planifier la synchronisation
        schedule.every(SYNC_INTERVAL_MINUTES).minutes.do(synchronize)

        # Planifier le retry des échecs toutes les heures
        schedule.every(1).hours.do(retry_failed_syncs)

        # Première synchronisation immédiate
        synchronize()

        # Boucle infinie
        print("\n✅ Service démarré - Synchronisation périodique active")
        print("   (Ctrl+C pour arrêter)\n")

        try:
            while True:
                schedule.run_pending()
                time.sleep(60)
        except KeyboardInterrupt:
            print("\n⛔ Arrêt du service de synchronisation...")
            show_sync_stats()

    else:
        # Mode périodique par défaut (avec schedule)
        print(f"🔄 Mode: Synchronisation périodique (toutes les {SYNC_INTERVAL_MINUTES} min)")

        schedule.every(SYNC_INTERVAL_MINUTES).minutes.do(synchronize)
        schedule.every(1).hours.do(retry_failed_syncs)

        synchronize()  # Sync initiale

        print("\n✅ Service démarré")
        print("   (Ctrl+C pour arrêter)\n")

        try:
            while True:
                schedule.run_pending()
                time.sleep(60)
        except KeyboardInterrupt:
            print("\n⛔ Arrêt du service...")
            show_sync_stats()

    return 0


if __name__ == '__main__':
    exit(main())
