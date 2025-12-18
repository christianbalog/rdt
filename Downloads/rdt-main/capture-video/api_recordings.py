#!/usr/bin/env python3
"""
API Flask pour récupérer les enregistrements vidéo depuis SQLite
Utilise la nouvelle structure surveillance.db
"""

from flask import Flask, jsonify, send_file, request
from flask_cors import CORS
import sqlite3
import io
from datetime import datetime

app = Flask(__name__)
CORS(app)

DB_PATH = "/data/surveillance.db"

def get_db_connection():
    """Connexion à la base de données SQLite"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


@app.route('/health', methods=['GET'])
def health():
    """Health check"""
    return jsonify({'status': 'ok', 'service': 'recordings-api'})


@app.route('/api/recordings', methods=['GET'])
def list_recordings():
    """
    Liste tous les enregistrements (médias) sans les blobs

    Query params:
        - device_id: Filtrer par device
        - type_media: Filtrer par type (video/photo)
        - numero_camera: Filtrer par caméra (1 ou 2)
        - limit: Nombre max de résultats (default: 50)
        - offset: Pagination (default: 0)
    """
    device_id = request.args.get('device_id')
    type_media = request.args.get('type_media')
    numero_camera = request.args.get('numero_camera', type=int)
    limit = int(request.args.get('limit', 50))
    offset = int(request.args.get('offset', 0))

    conn = get_db_connection()
    cursor = conn.cursor()

    query = """
        SELECT
            m.id_media,
            m.date,
            m.numero_camera,
            c.nom_capteur,
            c.etat_capteur
        FROM media m
        LEFT JOIN capteur c ON m.id_capteur = c.id_capteur
        WHERE 1=1
    """

    params = []

    if numero_camera:
        query += " AND m.numero_camera = ?"
        params.append(numero_camera)

    query += " ORDER BY m.date DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    cursor.execute(query, params)
    recordings = cursor.fetchall()

    result = []
    for row in recordings:
        result.append({
            'id': row['id_media'],
            'date': row['date'],
            'camera': row['numero_camera'],
            'sensor': row['nom_capteur'],
            'sensor_state': row['etat_capteur'],
            'video_url': f'/api/recordings/{row["id_media"]}/video'
        })

    conn.close()

    return jsonify({
        'recordings': result,
        'count': len(result),
        'limit': limit,
        'offset': offset
    })


@app.route('/api/recordings/<int:recording_id>', methods=['GET'])
def get_recording(recording_id):
    """
    Récupère les détails d'un média spécifique (sans le blob)
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            m.id_media,
            m.date,
            m.numero_camera,
            c.nom_capteur,
            c.etat_capteur
        FROM media m
        LEFT JOIN capteur c ON m.id_capteur = c.id_capteur
        WHERE m.id_media = ?
    """, (recording_id,))

    row = cursor.fetchone()
    conn.close()

    if not row:
        return jsonify({'error': 'Recording not found'}), 404

    return jsonify({
        'id': row['id_media'],
        'date': row['date'],
        'camera': row['numero_camera'],
        'sensor': row['nom_capteur'],
        'sensor_state': row['etat_capteur'],
        'video_url': f'/api/recordings/{row["id_media"]}/video'
    })


@app.route('/api/recordings/<int:recording_id>/video', methods=['GET'])
def get_recording_video(recording_id):
    """
    Télécharge la vidéo (blob) d'un média

    Returns:
        Video file (video/mp4)
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT m.video, m.id_media
        FROM media m
        WHERE m.id_media = ?
    """, (recording_id,))

    row = cursor.fetchone()
    conn.close()

    if not row:
        return jsonify({'error': 'Recording not found'}), 404

    video_blob = row['video']

    # Retourner le blob comme fichier
    return send_file(
        io.BytesIO(video_blob),
        mimetype='video/mp4',
        as_attachment=True,
        download_name=f'recording_{row["id_media"]}.mp4'
    )


@app.route('/api/recordings/<int:recording_id>', methods=['DELETE'])
def delete_recording(recording_id):
    """
    Supprime un média
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("DELETE FROM media WHERE id_media = ?", (recording_id,))
    deleted = cursor.rowcount

    conn.commit()
    conn.close()

    if deleted == 0:
        return jsonify({'error': 'Recording not found'}), 404

    return jsonify({'message': 'Recording deleted', 'id': recording_id})


@app.route('/api/recordings/stats', methods=['GET'])
def get_stats():
    """
    Statistiques sur les enregistrements
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # Statistiques globales
    cursor.execute("""
        SELECT COUNT(*) as total_recordings
        FROM media
    """)
    global_stats = cursor.fetchone()

    # Par caméra
    cursor.execute("""
        SELECT
            numero_camera,
            COUNT(*) as count
        FROM media
        GROUP BY numero_camera
    """)
    by_camera = []
    for row in cursor.fetchall():
        by_camera.append({
            'camera': row['numero_camera'],
            'count': row['count']
        })

    # Par capteur
    cursor.execute("""
        SELECT
            c.nom_capteur,
            COUNT(m.id_media) as count
        FROM media m
        LEFT JOIN capteur c ON m.id_capteur = c.id_capteur
        GROUP BY c.nom_capteur
    """)
    by_sensor = []
    for row in cursor.fetchall():
        by_sensor.append({
            'sensor': row['nom_capteur'],
            'count': row['count']
        })

    conn.close()

    return jsonify({
        'total_recordings': global_stats['total_recordings'],
        'by_camera': by_camera,
        'by_sensor': by_sensor
    })


if __name__ == '__main__':
    # Lancer l'API sur le port 5000
    app.run(host='0.0.0.0', port=5000, debug=False)
