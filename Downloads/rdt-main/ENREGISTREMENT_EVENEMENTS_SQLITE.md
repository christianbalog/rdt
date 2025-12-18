# Enregistrement des Événements dans SQLite - Documentation Complète

## Vue d'ensemble

**Tous les événements MQTT sont automatiquement enregistrés dans la base de données SQLite locale** `surveillance.db`.

## Flux Complet d'Enregistrement

```
1. Événement MQTT reçu
   ↓
2. Enregistrement IMMÉDIAT dans table 'evenement'
   ↓
3. Si MOTION_DETECTED → Capture vidéo
   ↓
4. Enregistrement vidéo dans table 'media'
```

---

## Service: surveillance_service.py

### 1. Réception d'un Événement MQTT

**Ligne 332-343** : Callback `on_message()`
```python
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
```

### 2. Identification du Capteur

**Ligne 345-357** : Mapping événement → capteur
```python
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
```

### 3. **ENREGISTREMENT DANS SQLite** ✅

**Ligne 359-366** : Enregistrement AUTOMATIQUE dans la BD
```python
# Enregistrer l'événement
id_evenement = save_evenement(nom_capteur)

if not id_evenement:
    print(f"❌ Impossible d'enregistrer l'événement")
    return

print(f"✅ Événement enregistré (ID: {id_evenement})")
```

**Ligne 140-170** : Fonction `save_evenement()`
```python
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

    conn = sqlite3.connect(DB_PATH)  # ← Connexion à /data/surveillance.db
    cursor = conn.cursor()

    now = datetime.now()

    cursor.execute("""
        INSERT INTO evenement (date, id_capteur)
        VALUES (?, ?)
    """, (now.isoformat(), id_capteur))  # ← INSERTION dans SQLite

    id_evenement = cursor.lastrowid
    conn.commit()  # ← COMMIT immédiat
    conn.close()

    return id_evenement
```

### 4. Capture Vidéo (si MOTION_DETECTED)

**Ligne 368-384** : Capture et enregistrement vidéo
```python
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
```

---

## Tous les Types d'Événements Enregistrés

### 1. MOTION_DETECTED (Détection de Mouvement)
```
Topic MQTT: sensor/motion ou sensors/+/motion
   ↓
Enregistrement dans 'evenement':
   - date: "2025-12-18T17:30:00.123456"
   - id_capteur: 1 (PIR Entrée)
   ↓
Capture vidéo (10 secondes)
   ↓
Enregistrement dans 'media':
   - video: [BLOB]
   - date: "2025-12-18T17:30:00.123456"
   - id_capteur: 4 (Caméra 1)
   - numero_camera: 1
```

**SQL Exécuté:**
```sql
-- Événement
INSERT INTO evenement (date, id_capteur)
VALUES ('2025-12-18T17:30:00.123456', 1);
-- Retourne: id_evenement = 42

-- Vidéo
INSERT INTO media (video, date, id_capteur, numero_camera)
VALUES ([BLOB 524288 bytes], '2025-12-18T17:30:00.123456', 4, 1);
-- Retourne: id_media = 15
```

### 2. BUTTON_PRESSED (Bouton Appuyé)
```
Topic MQTT: sensor/button
   ↓
Enregistrement dans 'evenement':
   - date: "2025-12-18T17:30:05.654321"
   - id_capteur: 3 (Bouton Arrêt)
   ↓
PAS de capture vidéo
```

**SQL Exécuté:**
```sql
INSERT INTO evenement (date, id_capteur)
VALUES ('2025-12-18T17:30:05.654321', 3);
-- Retourne: id_evenement = 43
```

### 3. PRESSURE_DETECTED (Pression Tapis)
```
Topic MQTT: sensor/pressure
   ↓
Enregistrement dans 'evenement':
   - date: "2025-12-18T17:30:10.987654"
   - id_capteur: 2 (Tapis Salon)
   ↓
PAS de capture vidéo
```

**SQL Exécuté:**
```sql
INSERT INTO evenement (date, id_capteur)
VALUES ('2025-12-18T17:30:10.987654', 2);
-- Retourne: id_evenement = 44
```

---

## Vérification de l'Enregistrement

### Consulter tous les événements enregistrés
```sql
SELECT
    e.id_evenement,
    e.date,
    c.nom_capteur,
    c.etat_capteur
FROM evenement e
JOIN capteur c ON e.id_capteur = c.id_capteur
ORDER BY e.date DESC
LIMIT 20;
```

**Résultat exemple:**
```
id_evenement | date                       | nom_capteur    | etat_capteur
-------------|----------------------------|----------------|-------------
44           | 2025-12-18T17:30:10.987654 | Tapis Salon    | 1
43           | 2025-12-18T17:30:05.654321 | Bouton Arrêt   | 1
42           | 2025-12-18T17:30:00.123456 | PIR Entrée     | 1
41           | 2025-12-18T17:25:00.111111 | PIR Entrée     | 1
40           | 2025-12-18T17:20:00.222222 | Tapis Salon    | 1
```

### Compter les événements par capteur
```sql
SELECT
    c.nom_capteur,
    COUNT(e.id_evenement) as nb_evenements
FROM capteur c
LEFT JOIN evenement e ON c.id_capteur = e.id_capteur
GROUP BY c.id_capteur
ORDER BY nb_evenements DESC;
```

**Résultat exemple:**
```
nom_capteur    | nb_evenements
---------------|---------------
PIR Entrée     | 85
Tapis Salon    | 42
Bouton Arrêt   | 12
Caméra 1       | 0
Caméra 2       | 0
```

### Événements avec vidéos associées
```sql
SELECT
    e.id_evenement,
    e.date as date_evenement,
    c.nom_capteur,
    COUNT(m.id_media) as nb_videos,
    SUM(LENGTH(m.video)) / 1024.0 / 1024.0 as taille_totale_mb
FROM evenement e
JOIN capteur c ON e.id_capteur = c.id_capteur
LEFT JOIN media m ON m.id_capteur IN (4, 5)  -- Caméras
    AND ABS(CAST(strftime('%s', m.date) AS INTEGER) - CAST(strftime('%s', e.date) AS INTEGER)) < 15
GROUP BY e.id_evenement
ORDER BY e.date DESC
LIMIT 10;
```

---

## Garanties d'Enregistrement

### ✅ Événements TOUJOURS Enregistrés

1. **Même si la capture vidéo échoue**
   - L'événement est enregistré AVANT la tentative de capture
   - Si capture échoue → événement reste dans la BD

2. **Même si le backend HTTP est down**
   - `surveillance_service.py` n'a PAS besoin du backend
   - Enregistrement 100% local dans SQLite

3. **Transactions atomiques**
   - `conn.commit()` immédiat après INSERT
   - Pas de perte de données même si crash après

4. **Persistance garantie**
   - Volume Kubernetes monté sur `/data`
   - SQLite sur disque persistant

### ❌ Cas où l'événement N'EST PAS enregistré

1. **Capteur inconnu**
   ```python
   if not nom_capteur:
       print(f"⚠️  Type d'événement non reconnu: {event_type}")
       return  # ← Pas d'enregistrement
   ```

2. **Capteur inexistant dans la BD**
   ```python
   if not id_capteur:
       print(f"⚠️  Capteur '{nom_capteur}' non trouvé dans la base")
       return None  # ← Pas d'enregistrement
   ```

3. **Message MQTT invalide (non-JSON)**
   ```python
   except json.JSONDecodeError:
       print(f"⚠️  Message MQTT non-JSON: {message.payload}")
       # ← Pas d'enregistrement
   ```

---

## Logs de Confirmation

### Sortie Console - Événement Enregistré
```
🚨 Événement reçu: MOTION_DETECTED
   Event ID: event_1734539400
   Topic: sensor/motion
✅ Événement enregistré (ID: 42)  ← CONFIRMATION SQLite
📹 Démarrage enregistrement vidéo...
   Fichier: /tmp/videos/recording_event_1734539400_1734539400.h264
   Durée: 10s
   Tentative avec libcamera-vid...
   ✅ Capturé avec libcamera-vid
✅ Enregistrement terminé
💾 Vidéo capturée: 524288 bytes
✅ Vidéo enregistrée (ID: 15)  ← CONFIRMATION SQLite
   Taille: 512.00 KB
```

### Sortie Console - Événement Sans Vidéo
```
🚨 Événement reçu: BUTTON_PRESSED
   Event ID: event_1734539405
   Topic: sensor/button
✅ Événement enregistré (ID: 43)  ← CONFIRMATION SQLite
```

---

## Configuration Base de Données

### Chemin de la Base
```python
DB_PATH = "/data/surveillance.db"
```

### Initialisation Automatique
Au démarrage du service, la structure est créée si elle n'existe pas :

```python
def init_database():
    """Initialise la base de données"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Crée les tables si elles n'existent pas
    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS capteur (...);
        CREATE TABLE IF NOT EXISTS evenement (...);
        CREATE TABLE IF NOT EXISTS media (...);

        -- Insère les capteurs par défaut
        INSERT OR IGNORE INTO capteur (...) VALUES (...);
    """)

    conn.commit()
    conn.close()
    print("✅ Base de données initialisée")
```

---

## Résumé

### Pour CHAQUE événement MQTT reçu :

| Étape | Action | Table | Résultat |
|-------|--------|-------|----------|
| 1 | Réception MQTT | - | `on_message()` appelé |
| 2 | Identification capteur | `capteur` | `id_capteur` trouvé |
| 3 | **ENREGISTREMENT** | `evenement` | **✅ INSERT INTO evenement** |
| 4 | Si MOTION → Capture | - | Vidéo capturée |
| 5 | Si vidéo OK | `media` | **✅ INSERT INTO media** |

### Données Persistées

- **evenement** : 100% des événements valides
- **media** : Uniquement pour MOTION_DETECTED (si capture réussie)

### Chemin Complet

```
MQTT (sensor/motion)
  ↓
surveillance_service.py : on_message()
  ↓
save_evenement('PIR Entrée')
  ↓
SQLite : INSERT INTO evenement
  ↓
COMMIT ← DONNÉES ENREGISTRÉES ✅
  ↓
record_video() (si motion)
  ↓
save_media(video_blob)
  ↓
SQLite : INSERT INTO media
  ↓
COMMIT ← VIDÉO ENREGISTRÉE ✅
```

**Tous les événements sont bien enregistrés localement dans SQLite !** 🎯
