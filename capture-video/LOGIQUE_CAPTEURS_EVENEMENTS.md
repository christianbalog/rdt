# 🎯 Logique Capteurs → Événements → Surveillance

## 📊 Architecture des Données

### 1. Table `capteur` = Capteurs Physiques

Les **capteurs** sont les services Python qui tournent sur le Raspberry Pi:

```sql
-- Capteurs physiques installés
INSERT INTO capteur (id_capteur, nom_capteur, type_capteur, device_id) VALUES
(1, 'PIR Entrée', 'motion', 'raspberry-1'),        -- sensor_motion.py
(2, 'Tapis Salon', 'pressure', 'raspberry-1'),     -- sensor_pressure.py (si vous l'avez)
(3, 'Bouton Arrêt', 'button', 'raspberry-1'),      -- sensor_button.py (si vous l'avez)
(4, 'Caméra 1', 'camera', 'raspberry-1');          -- Caméra pour capture vidéo
```

### 2. Table `evenement` = Détections des Capteurs

Quand un capteur détecte quelque chose, il crée un **événement**:

```sql
-- Exemple: PIR Entrée détecte un mouvement
INSERT INTO evenement (event_id, date_evenement, timestamp, etat_capteur, id_capteur, metadata)
VALUES (
  'evt-1737123456-abc123',           -- UUID de l'événement MQTT
  '2025-01-15T14:30:45',             -- Date ISO
  1737123456.123,                    -- Timestamp Unix
  1,                                  -- État = 1 (DÉTECTION ACTIVE)
  1,                                  -- id_capteur = PIR Entrée
  '{"source":"PIR","gpio_pin":17}'   -- Métadonnées JSON
);
```

**États possibles:**
- `etat_capteur = 1` → **Détection active** (MOTION_DETECTED, BUTTON_PRESSED, etc.)
- `etat_capteur = 0` → **Fin de détection** ou pas de détection

### 3. Table `media` = Vidéos Capturées

Suite à un événement de type "motion", le système capture une vidéo:

```sql
-- Vidéo capturée suite à l'événement #1
INSERT INTO media (type_media, video, taille, duree, id_capteur, id_evenement, numero_camera)
VALUES (
  'video',
  <BLOB>,        -- Données binaires de la vidéo
  2457600,       -- Taille en bytes (2.4 MB)
  10,            -- Durée: 10 secondes
  4,             -- id_capteur = Caméra 1
  1,             -- id_evenement = lié à l'événement de détection
  1              -- Caméra numéro 1
);
```

---

## 🔄 Flux Complet: Capteur → Surveillance

### Étape 1: Capteur Physique Détecte

**Service:** `sensor_motion.py` (sur Raspberry Pi)

```python
# Le PIR détecte un mouvement (GPIO 17 HIGH)
gpio.input(PIR_PIN) == gpio.HIGH

# Publier sur MQTT
mqtt_client.publish('sensor/motion', json.dumps({
    "event_id": "evt-1737123456-abc123",
    "device_id": "raspberry-1",
    "source": "PIR",
    "type": "MOTION_DETECTED",  # Type d'événement
    "data": {
        "gpio_pin": 17,
        "state": "HIGH"
    },
    "timestamp": "2025-01-15T14:30:45.123456"
}))
```

### Étape 2: MQTT Broker Distribue

**Service:** `mqtt-broker` (Mosquitto)

```
Topic: sensor/motion
Message reçu et distribué à tous les subscribers:
  → mqtt-bridge (vers backend cloud)
  → surveillance_service (enregistrement local)
```

### Étape 3: Surveillance Service Traite

**Service:** `surveillance_service.py`

```python
def on_message(client, userdata, message):
    payload = json.loads(message.payload.decode())

    # 1. Identifier le type de capteur
    if payload['type'] == 'MOTION_DETECTED':
        capteur_type = 'motion'  # → id_capteur = 1 (PIR Entrée)
        etat = 1                 # État = Détection active

    # 2. Enregistrer l'événement dans la BD
    id_evenement = save_evenement(
        event_id=payload['event_id'],
        capteur_type='motion',
        etat=1,                  # IMPORTANT: État = 1 pour détection
        metadata=payload
    )

    # 3. Si c'est un mouvement, capturer vidéo
    if capteur_type == 'motion':
        video_data = record_video(event_id)

        # 4. Enregistrer la vidéo liée à l'événement
        save_media(
            video_data=video_data,
            id_evenement=id_evenement,  # Lien vers l'événement
            id_capteur=4,                # Caméra 1
            numero_camera=1
        )
```

### Étape 4: Données Enregistrées

**Base de données:** `surveillance.db`

```sql
-- Table: evenement
SELECT * FROM evenement WHERE id_evenement = 1;

id_evenement | event_id              | date_evenement      | timestamp      | etat_capteur | id_capteur
-------------|-----------------------|---------------------|----------------|--------------|------------
1            | evt-1737123456-abc123 | 2025-01-15T14:30:45 | 1737123456.123 | 1            | 1

-- Table: media
SELECT * FROM media WHERE id_evenement = 1;

id_media | type_media | taille   | duree | id_capteur | id_evenement | numero_camera
---------|------------|----------|-------|------------|--------------|---------------
1        | video      | 2457600  | 10    | 4          | 1            | 1
```

---

## 📋 Mapping Complet

### De MQTT vers Base de Données

| Message MQTT | Événement BD | Caméra | Média |
|--------------|--------------|---------|-------|
| **topic:** `sensor/motion` | | | |
| **type:** `MOTION_DETECTED` | `etat_capteur = 1` | ✅ Capture vidéo | `type_media = 'video'` |
| **id_capteur:** PIR Entrée (1) | `id_capteur = 1` | `id_capteur = 4` (Caméra 1) | `id_evenement = lien` |
| | | | |
| **topic:** `sensor/button` | | | |
| **type:** `BUTTON_PRESSED` | `etat_capteur = 1` | ❌ Pas de capture | - |
| **id_capteur:** Bouton Arrêt (3) | `id_capteur = 3` | - | - |
| | | | |
| **topic:** `sensor/pressure` | | | |
| **type:** `PRESSURE_DETECTED` | `etat_capteur = 1` | ❌ Pas de capture | - |
| **id_capteur:** Tapis Salon (2) | `id_capteur = 2` | - | - |

### États du Capteur

```python
# Dans surveillance_service.py

# Mapping: type MQTT → id_capteur
CAPTEUR_MAPPING = {
    'MOTION_DETECTED': {
        'type': 'motion',
        'id_capteur': 1,        # PIR Entrée
        'etat': 1,              # Détection active
        'capture_video': True   # Lance la capture
    },
    'BUTTON_PRESSED': {
        'type': 'button',
        'id_capteur': 3,        # Bouton Arrêt
        'etat': 1,              # Bouton appuyé
        'capture_video': False  # Pas de capture
    },
    'PRESSURE_DETECTED': {
        'type': 'pressure',
        'id_capteur': 2,        # Tapis Salon
        'etat': 1,              # Pression détectée
        'capture_video': False  # Pas de capture (sauf si vous voulez)
    }
}
```

---

## 🎬 Exemple Complet: Détection de Mouvement

### T=0s : Détection

```
PIR Entrée (GPIO 17)
    └─ État: HIGH
    └─ Déclenche: sensor_motion.py
```

### T=0.1s : Publication MQTT

```json
{
  "event_id": "evt-1737123456-abc123",
  "device_id": "raspberry-1",
  "source": "PIR",
  "type": "MOTION_DETECTED",
  "data": {"gpio_pin": 17, "state": "HIGH"},
  "timestamp": "2025-01-15T14:30:45.123456"
}
```

### T=0.2s : Réception par surveillance_service

```python
# surveillance_service.py reçoit le message
capteur_type = 'motion'  # Déterminé depuis 'MOTION_DETECTED'
id_capteur = 1           # PIR Entrée
etat = 1                 # Détection active
```

### T=0.3s : Enregistrement Événement

```sql
INSERT INTO evenement (event_id, etat_capteur, id_capteur, ...)
VALUES ('evt-1737123456-abc123', 1, 1, ...);
-- Retourne: id_evenement = 1
```

### T=0.4s → T=10.4s : Capture Vidéo

```bash
📹 Démarrage enregistrement vidéo...
   Durée: 10s
   Méthode: ffmpeg
✅ Capturé: 2457600 bytes
```

### T=10.5s : Enregistrement Vidéo

```sql
INSERT INTO media (type_media, video, id_evenement, id_capteur, ...)
VALUES ('video', <BLOB>, 1, 4, ...);
-- id_media = 1
-- id_evenement = 1 (lien vers l'événement qui a déclenché)
-- id_capteur = 4 (Caméra 1)
```

### T=10.6s : Résultat Final

```sql
-- Requête pour voir l'événement avec son média
SELECT
    e.event_id,
    e.date_evenement,
    c1.nom_capteur as capteur_declencheur,
    m.id_media,
    m.taille / 1024.0 / 1024.0 as taille_mb,
    c2.nom_capteur as camera
FROM evenement e
JOIN capteur c1 ON e.id_capteur = c1.id_capteur
LEFT JOIN media m ON e.id_evenement = m.id_evenement
LEFT JOIN capteur c2 ON m.id_capteur = c2.id_capteur
WHERE e.id_evenement = 1;
```

**Résultat:**
```
event_id               | date_evenement      | capteur_declencheur | id_media | taille_mb | camera
-----------------------|---------------------|---------------------|----------|-----------|--------
evt-1737123456-abc123  | 2025-01-15T14:30:45 | PIR Entrée          | 1        | 2.34      | Caméra 1
```

---

## 🔍 Requêtes Utiles

### 1. Voir tous les événements avec leurs capteurs

```sql
SELECT
    e.id_evenement,
    e.event_id,
    e.date_evenement,
    e.etat_capteur,
    c.nom_capteur,
    c.type_capteur,
    CASE WHEN m.id_media IS NOT NULL THEN 'Oui' ELSE 'Non' END as has_media
FROM evenement e
JOIN capteur c ON e.id_capteur = c.id_capteur
LEFT JOIN media m ON e.id_evenement = m.id_evenement
ORDER BY e.timestamp DESC
LIMIT 10;
```

### 2. Statistiques par capteur

```sql
SELECT
    c.nom_capteur,
    c.type_capteur,
    COUNT(e.id_evenement) as nb_evenements,
    COUNT(m.id_media) as nb_medias,
    SUM(m.taille) / 1024.0 / 1024.0 as total_mb
FROM capteur c
LEFT JOIN evenement e ON c.id_capteur = e.id_capteur
    AND e.etat_capteur = 1  -- Seulement les détections actives
LEFT JOIN media m ON e.id_evenement = m.id_evenement
GROUP BY c.id_capteur
ORDER BY nb_evenements DESC;
```

### 3. Dernières détections avec vidéos

```sql
SELECT
    e.event_id,
    datetime(e.date_evenement) as date,
    c1.nom_capteur as declencheur,
    m.taille / 1024.0 / 1024.0 as taille_mb,
    m.duree as duree_s
FROM evenement e
JOIN capteur c1 ON e.id_capteur = c1.id_capteur
JOIN media m ON e.id_evenement = m.id_evenement
WHERE e.etat_capteur = 1
ORDER BY e.timestamp DESC
LIMIT 20;
```

---

## ✅ Résumé

| Élément | Rôle | Exemple |
|---------|------|---------|
| **Capteur physique** | Service Python sur Raspberry Pi | `sensor_motion.py` (GPIO 17) |
| **Topic MQTT** | Canal de communication | `sensor/motion` |
| **Type événement** | Nature de la détection | `MOTION_DETECTED` |
| **Table `capteur`** | Référence des capteurs physiques | PIR Entrée (id=1, type=motion) |
| **Table `evenement`** | Historique des détections | event_id, etat=1, id_capteur=1 |
| **Table `media`** | Vidéos capturées | video BLOB, lié à id_evenement |
| **etat_capteur = 1** | Détection active | Mouvement détecté, bouton appuyé |
| **etat_capteur = 0** | Pas de détection | Fin de mouvement, bouton relâché |

🎯 **Flux simplifié:**
```
Capteur détecte → MQTT publie → surveillance_service reçoit →
INSERT evenement (etat=1) → Capture vidéo → INSERT media (lié à evenement)
```

Tout est lié! Chaque vidéo sait quel événement l'a déclenchée, et chaque événement sait quel capteur l'a généré. 🔗
