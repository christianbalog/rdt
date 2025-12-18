# Service de Synchronisation SQLite Local → Serveur Distant

## Vue d'ensemble

Service intelligent qui synchronise automatiquement la base de données SQLite locale (Raspberry Pi) avec le serveur distant, **sans créer de doublons**.

## Fonctionnalités Clés

✅ **Anti-doublons** - Table de suivi pour éviter les synchronisations multiples
✅ **Synchronisation périodique** - Toutes les X minutes (configurable)
✅ **Retry automatique** - Nouvelle tentative des échecs toutes les heures
✅ **Gestion des erreurs** - Continue même si le serveur est down
✅ **Statistiques** - Rapport détaillé après chaque synchronisation
✅ **Léger** - Tourne sur Raspberry Pi avec peu de ressources

---

## Architecture

```
┌─────────────────────────────────┐
│  Raspberry Pi                   │
│                                 │
│  ┌──────────────────────────┐  │
│  │ surveillance.db (LOCAL)  │  │
│  │  - evenement             │  │
│  │  - media                 │  │
│  │  - sync_tracking  ←NEW   │  │
│  └──────────┬───────────────┘  │
│             │                   │
│  ┌──────────▼───────────────┐  │
│  │  sync-service.py         │  │
│  │  (Ce nouveau service)    │  │
│  └──────────┬───────────────┘  │
└─────────────┼───────────────────┘
              │ HTTP POST
              ▼
┌─────────────────────────────────┐
│  Serveur Distant                │
│                                 │
│  ┌──────────────────────────┐  │
│  │ Backend API              │  │
│  │  POST /api/evenements    │  │
│  │  POST /api/media         │  │
│  └──────────┬───────────────┘  │
│             │                   │
│  ┌──────────▼───────────────┐  │
│  │ Base de données serveur  │  │
│  │  (PostgreSQL/MySQL/...)  │  │
│  └──────────────────────────┘  │
└─────────────────────────────────┘
```

---

## Nouvelle Table: sync_tracking

Cette table **évite les doublons** en gardant la trace de ce qui a déjà été synchronisé.

```sql
CREATE TABLE sync_tracking (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,           -- 'evenement' ou 'media'
    local_id INTEGER NOT NULL,          -- ID local (id_evenement ou id_media)
    remote_id INTEGER,                  -- ID distant retourné par le serveur
    sync_date TEXT NOT NULL,            -- Date de synchronisation
    sync_status TEXT NOT NULL,          -- 'pending', 'success', 'failed'
    error_message TEXT,                 -- Message d'erreur si échec
    UNIQUE(table_name, local_id)        -- ← Évite les doublons
);
```

### Exemple de Données

| id | table_name | local_id | remote_id | sync_date | sync_status | error_message |
|----|------------|----------|-----------|-----------|-------------|---------------|
| 1 | evenement | 42 | 123 | 2025-12-18T17:30:00 | success | NULL |
| 2 | evenement | 43 | 124 | 2025-12-18T17:35:00 | success | NULL |
| 3 | media | 15 | 58 | 2025-12-18T17:30:05 | success | NULL |
| 4 | evenement | 44 | NULL | 2025-12-18T17:40:00 | failed | Serveur inaccessible |

---

## Fonctionnement Anti-Doublons

### 1. Récupération des Données Non Synchronisées

```python
def get_unsync_evenements():
    """Récupère UNIQUEMENT les événements NON synchronisés"""
    cursor.execute("""
        SELECT e.*
        FROM evenement e
        WHERE e.id_evenement NOT IN (
            SELECT local_id
            FROM sync_tracking
            WHERE table_name = 'evenement'
            AND sync_status = 'success'  ← Uniquement les succès
        )
        ORDER BY e.date ASC
    """)
```

**Résultat:**
- Si `id_evenement=42` est dans `sync_tracking` avec `success` → **IGNORÉ**
- Si `id_evenement=45` n'est PAS dans `sync_tracking` → **SYNCHRONISÉ**

### 2. Synchronisation vers le Serveur

```python
def sync_evenement(evenement):
    # Envoyer au serveur
    response = requests.post(
        f'{BACKEND_URL}/api/evenements',
        json=payload,
        timeout=10
    )

    if response.status_code == 201:
        remote_data = response.json()
        remote_id = remote_data.get('id')  # ← ID distant

        # Marquer comme synchronisé
        mark_as_synced('evenement', evenement['id_evenement'], remote_id, True)
```

### 3. Enregistrement du Suivi

```python
def mark_as_synced(table_name, local_id, remote_id, success):
    cursor.execute("""
        INSERT OR REPLACE INTO sync_tracking
        (table_name, local_id, remote_id, sync_date, sync_status)
        VALUES (?, ?, ?, ?, ?)
    """, (table_name, local_id, remote_id, datetime.now(), 'success'))
```

**Résultat dans `sync_tracking`:**
```sql
INSERT INTO sync_tracking
VALUES ('evenement', 42, 123, '2025-12-18T17:30:00', 'success', NULL);
```

### 4. Prochaine Synchronisation

Lors de la prochaine exécution, `id_evenement=42` sera **ignoré** car déjà dans `sync_tracking` avec status `success`.

---

## Flux Complet de Synchronisation

```
┌─────────────────────────────────────────────────────────┐
│ 1. Timer déclenche synchronize() toutes les 5 min      │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│ 2. get_unsync_evenements()                              │
│    → SELECT WHERE id NOT IN sync_tracking              │
│    Résultat: [evt_42, evt_43, evt_44]                   │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│ 3. Pour chaque événement:                               │
│    sync_evenement(evt)                                  │
│      → POST /api/evenements                             │
│      → Serveur retourne {id: 123}                       │
│      → mark_as_synced('evenement', 42, 123, True)       │
│         INSERT INTO sync_tracking                       │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│ 4. get_unsync_media()                                   │
│    → SELECT WHERE id NOT IN sync_tracking               │
│    Résultat: [media_15, media_16]                       │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│ 5. Pour chaque média:                                   │
│    sync_media(media)                                    │
│      → Encode BLOB en base64                            │
│      → POST /api/media                                  │
│      → Serveur retourne {id: 58}                        │
│      → mark_as_synced('media', 15, 58, True)            │
│         INSERT INTO sync_tracking                       │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│ 6. Afficher rapport de synchronisation                  │
│    ✅ Événements: 3 synchronisés, 0 échoués             │
│    ✅ Médias: 2 synchronisés, 0 échoués                 │
└─────────────────────────────────────────────────────────┘
```

---

## Modes de Fonctionnement

### Mode 1: Synchronisation Continue (par défaut)

```bash
export SYNC_MODE=continuous
export SYNC_INTERVAL_MINUTES=5
python sync-service.py
```

**Comportement:**
- Synchronise toutes les 5 minutes
- Retry des échecs toutes les heures
- Tourne en continu

### Mode 2: Synchronisation Unique

```bash
export SYNC_MODE=once
python sync-service.py
```

**Comportement:**
- Synchronise une seule fois
- Affiche les statistiques
- Se termine

### Mode 3: Synchronisation Périodique (legacy)

```bash
export SYNC_MODE=periodic
export SYNC_INTERVAL_MINUTES=10
python sync-service.py
```

**Comportement:**
- Comme `continuous` mais avec schedule différent

---

## Configuration

### Variables d'Environnement

| Variable | Défaut | Description |
|----------|--------|-------------|
| `LOCAL_DB_PATH` | `/data/surveillance.db` | Chemin vers la BD locale |
| `BACKEND_URL` | `http://backend:8000` | URL du serveur distant |
| `SYNC_INTERVAL_MINUTES` | `5` | Intervalle de synchronisation |
| `DEVICE_ID` | `raspberry-1` | ID du device |
| `SYNC_MODE` | `continuous` | Mode: once, periodic, continuous |

### Exemple de Configuration

```bash
# .env
LOCAL_DB_PATH=/data/surveillance.db
BACKEND_URL=https://mon-serveur.com
SYNC_INTERVAL_MINUTES=10
DEVICE_ID=raspberry-salon
SYNC_MODE=continuous
```

---

## Déploiement

### Sur Raspberry Pi (Docker)

**1. Build l'image:**
```bash
cd raspberry-services
docker build -f Dockerfile.sync -t sync-service:latest .
```

**2. Lancer le service:**
```bash
docker run -d \
  --name sync-service \
  -v /data:/data \
  -e BACKEND_URL=http://192.168.1.100:8000 \
  -e SYNC_INTERVAL_MINUTES=5 \
  -e DEVICE_ID=raspberry-1 \
  sync-service:latest
```

**3. Voir les logs:**
```bash
docker logs -f sync-service
```

### Sur Raspberry Pi (Systemd)

**1. Créer le fichier service:**
```bash
sudo nano /etc/systemd/system/sync-service.service
```

```ini
[Unit]
Description=Service de Synchronisation SQLite
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/rdt/raspberry-services
Environment="LOCAL_DB_PATH=/data/surveillance.db"
Environment="BACKEND_URL=http://backend:8000"
Environment="SYNC_INTERVAL_MINUTES=5"
Environment="DEVICE_ID=raspberry-1"
Environment="SYNC_MODE=continuous"
ExecStart=/usr/bin/python3 /home/pi/rdt/raspberry-services/sync-service.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**2. Activer et démarrer:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable sync-service
sudo systemctl start sync-service
sudo systemctl status sync-service
```

**3. Voir les logs:**
```bash
sudo journalctl -u sync-service -f
```

---

## Sortie Console

### Démarrage
```
╔════════════════════════════════════════════════════════════╗
║         Service de Synchronisation - raspberry-1           ║
╚════════════════════════════════════════════════════════════╝

💾 Base de données locale: /data/surveillance.db
🌐 Serveur distant: http://backend:8000
⏱️  Intervalle de sync: 5 minutes

✅ Table de suivi des synchronisations initialisée
🔄 Mode: Synchronisation continue (toutes les 5 min)
```

### Synchronisation en Cours
```
🔄 Début de synchronisation - 2025-12-18 17:30:00

📋 Synchronisation des événements...
   3 événement(s) à synchroniser
✅ Événement 42 → Serveur (ID: 123)
✅ Événement 43 → Serveur (ID: 124)
✅ Événement 44 → Serveur (ID: 125)

📹 Synchronisation des médias...
   2 média(s) à synchroniser
✅ Média 15 → Serveur (ID: 58, 512.00 KB)
✅ Média 16 → Serveur (ID: 59, 498.25 KB)

╔════════════════════════════════════════════════════════════╗
║                  Rapport de Synchronisation                ║
╠════════════════════════════════════════════════════════════╣
║  Événements synchronisés :   3                             ║
║  Événements échoués      :   0                             ║
║  Médias synchronisés     :   2                             ║
║  Médias échoués          :   0                             ║
╚════════════════════════════════════════════════════════════╝
```

### Aucune Synchronisation Nécessaire
```
🔄 Début de synchronisation - 2025-12-18 17:35:00

📋 Synchronisation des événements...
   ✅ Tous les événements sont déjà synchronisés

📹 Synchronisation des médias...
   ✅ Tous les médias sont déjà synchronisés

╔════════════════════════════════════════════════════════════╗
║                  Rapport de Synchronisation                ║
╠════════════════════════════════════════════════════════════╣
║  Événements synchronisés :   0                             ║
║  Événements échoués      :   0                             ║
║  Médias synchronisés     :   0                             ║
║  Médias échoués          :   0                             ║
╚════════════════════════════════════════════════════════════╝
```

### Serveur Inaccessible
```
🔄 Début de synchronisation - 2025-12-18 17:40:00

📋 Synchronisation des événements...
   1 événement(s) à synchroniser
⚠️  Serveur inaccessible
❌ Erreur sync événement 45: Serveur inaccessible

╔════════════════════════════════════════════════════════════╗
║                  Rapport de Synchronisation                ║
╠════════════════════════════════════════════════════════════╣
║  Événements synchronisés :   0                             ║
║  Événements échoués      :   1                             ║
║  Médias synchronisés     :   0                             ║
║  Médias échoués          :   0                             ║
╚════════════════════════════════════════════════════════════╝
```

---

## Commandes Utiles

### Voir les Statistiques de Synchronisation
```python
python sync-service.py
# Puis Ctrl+C pour voir les stats finales
```

```
📊 Statistiques de synchronisation:
   evenement    - success :   85
   evenement    - failed  :    2
   media        - success :   60
   media        - failed  :    0
```

### Réinitialiser le Suivi (ATTENTION)
```sql
-- Depuis SQLite
DELETE FROM sync_tracking;
```
⚠️ **Attention:** Cela resynchronisera TOUT lors de la prochaine exécution !

### Voir les Échecs
```sql
SELECT * FROM sync_tracking
WHERE sync_status = 'failed'
ORDER BY sync_date DESC;
```

### Forcer une Nouvelle Tentative des Échecs
Le service le fait automatiquement toutes les heures, ou manuellement :

```sql
UPDATE sync_tracking
SET sync_status = 'pending'
WHERE sync_status = 'failed';
```

---

## API Backend Requise

Le serveur distant doit exposer ces endpoints :

### POST /api/evenements
```json
{
  "date": "2025-12-18T17:30:00.123456",
  "capteur": {
    "id": 1,
    "nom": "PIR Entrée",
    "etat": 1
  },
  "device_id": "raspberry-1",
  "source": "sync_service"
}
```

**Réponse attendue (201 Created):**
```json
{
  "id": 123,
  "date": "2025-12-18T17:30:00.123456",
  "capteur_id": 1,
  "message": "Événement créé"
}
```

### POST /api/media
```json
{
  "date": "2025-12-18T17:30:00.123456",
  "capteur": {
    "id": 4,
    "nom": "Caméra 1"
  },
  "numero_camera": 1,
  "video_data": "base64_encoded_video_blob...",
  "device_id": "raspberry-1",
  "source": "sync_service"
}
```

**Réponse attendue (201 Created):**
```json
{
  "id": 58,
  "date": "2025-12-18T17:30:00.123456",
  "capteur_id": 4,
  "size_kb": 512.00,
  "message": "Média créé"
}
```

---

## Avantages de Cette Solution

✅ **Pas de doublons** - Table `sync_tracking` avec contrainte UNIQUE
✅ **Résilience** - Continue même si serveur down
✅ **Retry automatique** - Nouvelle tentative des échecs
✅ **Mapping local ↔ distant** - Garde la correspondance des IDs
✅ **Léger** - Peu de ressources nécessaires
✅ **Transparent** - Ne modifie pas les données existantes
✅ **Statistiques** - Rapport détaillé après chaque sync
✅ **Configurable** - Intervalle et mode ajustables

---

## Résumé

Ce service de synchronisation garantit que :

1. **Tous les événements** de la BD locale sont envoyés au serveur
2. **Aucun doublon** n'est créé grâce à la table `sync_tracking`
3. **Les échecs** sont retentés automatiquement
4. **Le mapping** local_id ↔ remote_id est conservé
5. **La synchronisation** est périodique et automatique

**Le service tourne en arrière-plan sur le Raspberry Pi et synchronise intelligemment la BD locale avec le serveur distant.** 🚀
