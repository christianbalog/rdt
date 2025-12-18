# 📊 Tables de surveillance.db

## Liste des Tables

```
surveillance.db
├── capteur
├── evenement
├── media
├── notification
└── configuration
```

---

## 📋 Table: `capteur`

**Description:** Capteurs physiques connectés au Raspberry Pi

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id_capteur` | INTEGER | PRIMARY KEY AUTOINCREMENT | ID unique du capteur |
| `nom_capteur` | TEXT | NOT NULL | Nom du capteur (ex: "PIR Entrée") |
| `type_capteur` | TEXT | NOT NULL, CHECK | Type: 'motion', 'pressure', 'button', 'camera' |
| `device_id` | TEXT | NULL | ID MQTT du device (ex: 'raspberry-1') |
| `actif` | INTEGER | NOT NULL, DEFAULT 1 | 0 = désactivé, 1 = actif |
| `date_creation` | TEXT | NOT NULL, DEFAULT now | Date de création ISO |

**Index:**
- `idx_capteur_type` sur `type_capteur`
- `idx_capteur_actif` sur `actif`

**Données initiales:**
```sql
INSERT INTO capteur (id_capteur, nom_capteur, type_capteur, device_id) VALUES
(1, 'PIR Entrée', 'motion', 'raspberry-1'),
(2, 'Tapis Salon', 'pressure', 'raspberry-1'),
(3, 'Bouton Arrêt', 'button', 'raspberry-1'),
(4, 'Caméra 1', 'camera', 'raspberry-1');
```

---

## 📋 Table: `evenement`

**Description:** Événements générés par les capteurs

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id_evenement` | INTEGER | PRIMARY KEY AUTOINCREMENT | ID unique de l'événement |
| `event_id` | TEXT | UNIQUE | UUID de l'événement MQTT |
| `date_evenement` | TEXT | NOT NULL | Date ISO 8601 |
| `timestamp` | REAL | NOT NULL | Timestamp Unix (pour requêtes rapides) |
| `etat_capteur` | INTEGER | NOT NULL, CHECK | 0 = inactif, 1 = détection active |
| `id_capteur` | INTEGER | NOT NULL, FK | Référence vers capteur |
| `metadata` | TEXT | NULL | JSON avec données additionnelles |

**Relations:**
- `FOREIGN KEY (id_capteur) REFERENCES capteur(id_capteur) ON DELETE CASCADE`

**Index:**
- `idx_evenement_capteur` sur `(id_capteur, date_evenement DESC)`
- `idx_evenement_timestamp` sur `timestamp DESC`
- `idx_evenement_event_id` sur `event_id`

**Exemple de données:**
```sql
INSERT INTO evenement VALUES (
  1,                          -- id_evenement
  'evt-1737123456-abc123',    -- event_id
  '2025-01-15T14:30:45',      -- date_evenement
  1737123456.123,             -- timestamp
  1,                          -- etat_capteur (détection)
  1,                          -- id_capteur (PIR Entrée)
  '{"source":"PIR","gpio":17}' -- metadata
);
```

---

## 📋 Table: `media`

**Description:** Photos ou vidéos capturées par les caméras

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id_media` | INTEGER | PRIMARY KEY AUTOINCREMENT | ID unique du média |
| `type_media` | TEXT | NOT NULL, CHECK | 'video' ou 'photo' |
| `video` | BLOB | NOT NULL | Contenu binaire du média |
| `taille` | INTEGER | NOT NULL | Taille en bytes |
| `duree` | INTEGER | NULL | Durée en secondes (vidéos uniquement) |
| `date_media` | TEXT | NOT NULL | Date ISO 8601 |
| `timestamp` | REAL | NOT NULL | Timestamp Unix |
| `id_capteur` | INTEGER | NOT NULL, FK | Référence vers capteur (caméra) |
| `id_evenement` | INTEGER | NULL, FK | Référence vers événement déclencheur |
| `numero_camera` | INTEGER | NOT NULL, CHECK | 1 ou 2 |
| `resolution` | TEXT | NULL | ex: '1280x720' |
| `codec` | TEXT | NULL | ex: 'h264', 'mjpeg' |

**Relations:**
- `FOREIGN KEY (id_capteur) REFERENCES capteur(id_capteur) ON DELETE CASCADE`
- `FOREIGN KEY (id_evenement) REFERENCES evenement(id_evenement) ON DELETE SET NULL`

**Index:**
- `idx_media_capteur` sur `(id_capteur, date_media DESC)`
- `idx_media_evenement` sur `id_evenement`
- `idx_media_camera` sur `(numero_camera, date_media DESC)`
- `idx_media_timestamp` sur `timestamp DESC`
- `idx_media_type` sur `type_media`

**Exemple de données:**
```sql
INSERT INTO media VALUES (
  1,                -- id_media
  'video',          -- type_media
  <BLOB>,           -- video (données binaires)
  2457600,          -- taille (2.4 MB)
  10,               -- duree (10 secondes)
  '2025-01-15T14:30:45', -- date_media
  1737123456.123,   -- timestamp
  4,                -- id_capteur (Caméra 1)
  1,                -- id_evenement (lié à l'événement)
  1,                -- numero_camera
  '1280x720',       -- resolution
  'h264'            -- codec
);
```

---

## 📋 Table: `notification`

**Description:** Historique des notifications envoyées

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id_notification` | INTEGER | PRIMARY KEY AUTOINCREMENT | ID unique de la notification |
| `id_evenement` | INTEGER | NOT NULL, FK | Référence vers événement |
| `mode` | TEXT | NOT NULL, CHECK | 'actif' ou 'surveillance' |
| `envoyee` | INTEGER | NOT NULL, CHECK | 0 = non envoyée, 1 = envoyée |
| `date_notification` | TEXT | NOT NULL | Date ISO 8601 |
| `type_notification` | TEXT | NULL | 'websocket', 'email', 'sms', etc. |

**Relations:**
- `FOREIGN KEY (id_evenement) REFERENCES evenement(id_evenement) ON DELETE CASCADE`

**Index:**
- `idx_notification_evenement` sur `id_evenement`
- `idx_notification_date` sur `date_notification DESC`

**Exemple de données:**
```sql
INSERT INTO notification VALUES (
  1,                        -- id_notification
  1,                        -- id_evenement
  'surveillance',           -- mode
  1,                        -- envoyee (oui)
  '2025-01-15T14:30:46',   -- date_notification
  'websocket'               -- type_notification
);
```

---

## 📋 Table: `configuration`

**Description:** Paramètres système

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `cle` | TEXT | PRIMARY KEY | Nom du paramètre |
| `valeur` | TEXT | NOT NULL | Valeur du paramètre (JSON si complexe) |
| `date_modification` | TEXT | NOT NULL, DEFAULT now | Date de dernière modification |

**Pas d'index** (table de configuration, peu de données)

**Configuration par défaut:**
```sql
INSERT INTO configuration (cle, valeur) VALUES
('mode_systeme', 'actif'),
('duree_enregistrement', '10'),
('resolution_video', '1280x720'),
('fps_video', '30'),
('codec_video', 'h264'),
('retention_jours', '30');
```

---

## 🔍 Vue: `vue_evenements_recents`

**Description:** Vue optimisée pour afficher les événements récents avec leurs médias

```sql
CREATE VIEW vue_evenements_recents AS
SELECT
    e.id_evenement,
    e.event_id,
    e.date_evenement,
    e.timestamp,
    e.etat_capteur,
    e.metadata,
    c.id_capteur,
    c.nom_capteur,
    c.type_capteur,
    c.device_id,
    COUNT(m.id_media) as nb_medias,
    SUM(m.taille) as taille_totale_medias
FROM evenement e
JOIN capteur c ON e.id_capteur = c.id_capteur
LEFT JOIN media m ON e.id_evenement = m.id_evenement
GROUP BY e.id_evenement
ORDER BY e.timestamp DESC
LIMIT 100;
```

**Utilisation:**
```sql
SELECT * FROM vue_evenements_recents;
```

---

## 🔧 Trigger: `trigger_purge_anciens_medias`

**Description:** Supprime automatiquement les médias de plus de 30 jours

```sql
CREATE TRIGGER trigger_purge_anciens_medias
AFTER INSERT ON media
BEGIN
    DELETE FROM media
    WHERE timestamp < (strftime('%s', 'now') - 2592000);
END;
```

**Durée configurable:**
- 30 jours = 2592000 secondes
- Modifier la valeur dans le trigger ou via configuration

---

## 📊 Relations entre Tables

```
capteur (id_capteur)
    ↓
    ├─→ evenement (id_capteur) [CASCADE]
    │       ↓
    │       ├─→ media (id_evenement) [SET NULL]
    │       └─→ notification (id_evenement) [CASCADE]
    │
    └─→ media (id_capteur) [CASCADE]
```

**Cascade DELETE:**
- Supprimer un capteur → supprime ses événements, médias et notifications
- Supprimer un événement → supprime ses notifications, mais média.id_evenement = NULL

---

## 🔢 Statistiques de Stockage

| Table | Taille typique par ligne | Croissance |
|-------|---------------------------|------------|
| `capteur` | ~100 bytes | Fixe (4-10 lignes) |
| `evenement` | ~200 bytes | +1 par détection |
| `media` | ~2-5 MB | +1 par vidéo capturée |
| `notification` | ~100 bytes | +1 par notification |
| `configuration` | ~50 bytes | Fixe (~6 lignes) |

**Exemple de calcul:**
- 10 détections/jour × 30 jours = 300 événements = ~60 KB
- 10 vidéos/jour × 30 jours = 300 vidéos × 2.5 MB = **750 MB**
- La majorité de l'espace est occupé par les BLOBs vidéo

---

## 🛠️ Commandes Utiles

### Lister toutes les tables
```bash
docker compose exec capture-video sqlite3 /data/surveillance.db ".tables"
```

**Sortie:**
```
capteur         evenement       media
notification    configuration   vue_evenements_recents
```

### Voir la structure d'une table
```bash
docker compose exec capture-video sqlite3 /data/surveillance.db ".schema capteur"
```

### Compter les lignes de chaque table
```sql
SELECT 'capteur' as table_name, COUNT(*) as count FROM capteur
UNION ALL
SELECT 'evenement', COUNT(*) FROM evenement
UNION ALL
SELECT 'media', COUNT(*) FROM media
UNION ALL
SELECT 'notification', COUNT(*) FROM notification
UNION ALL
SELECT 'configuration', COUNT(*) FROM configuration;
```

### Voir la taille de la base
```bash
docker compose exec capture-video sh -c "ls -lh /data/surveillance.db"
```

### Export de toute la structure
```bash
docker compose exec capture-video sqlite3 /data/surveillance.db ".schema" > schema.sql
```

---

## ✅ Résumé

| # | Table | Description | Lignes typiques |
|---|-------|-------------|-----------------|
| 1 | `capteur` | Capteurs physiques | 4-10 |
| 2 | `evenement` | Détections des capteurs | 100-1000+ |
| 3 | `media` | Vidéos/photos capturées | 100-1000+ |
| 4 | `notification` | Historique notifications | 100-1000+ |
| 5 | `configuration` | Paramètres système | 6-20 |

**Relations clés:**
- Chaque **événement** est lié à un **capteur**
- Chaque **média** est lié à un **événement** (déclencheur) et un **capteur** (caméra)
- Chaque **notification** est liée à un **événement**

🎯 Structure relationnelle complète avec intégrité référentielle!
