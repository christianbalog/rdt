-- ============================================
-- Script d'initialisation - surveillance.db
-- Base de données pour système de surveillance
-- ============================================

-- Table: capteur
-- Gestion des capteurs physiques
CREATE TABLE IF NOT EXISTS capteur (
    id_capteur INTEGER PRIMARY KEY AUTOINCREMENT,
    nom_capteur TEXT NOT NULL,
    type_capteur TEXT NOT NULL CHECK(type_capteur IN ('motion', 'pressure', 'button', 'camera')),
    device_id TEXT,
    actif INTEGER NOT NULL DEFAULT 1 CHECK(actif IN (0, 1)),
    date_creation TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_capteur_type ON capteur(type_capteur);
CREATE INDEX IF NOT EXISTS idx_capteur_actif ON capteur(actif);

-- Table: evenement
-- Historique des événements des capteurs
CREATE TABLE IF NOT EXISTS evenement (
    id_evenement INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT UNIQUE,
    date_evenement TEXT NOT NULL,
    timestamp REAL NOT NULL,
    etat_capteur INTEGER NOT NULL CHECK(etat_capteur IN (0, 1)),
    id_capteur INTEGER NOT NULL,
    metadata TEXT,
    FOREIGN KEY (id_capteur) REFERENCES capteur(id_capteur) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_evenement_capteur ON evenement(id_capteur, date_evenement DESC);
CREATE INDEX IF NOT EXISTS idx_evenement_timestamp ON evenement(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_evenement_event_id ON evenement(event_id);

-- Table: media
-- Stockage des photos et vidéos
CREATE TABLE IF NOT EXISTS media (
    id_media INTEGER PRIMARY KEY AUTOINCREMENT,
    type_media TEXT NOT NULL CHECK(type_media IN ('video', 'photo')),
    video BLOB NOT NULL,
    taille INTEGER NOT NULL,
    duree INTEGER,
    date_media TEXT NOT NULL,
    timestamp REAL NOT NULL,
    id_capteur INTEGER NOT NULL,
    id_evenement INTEGER,
    numero_camera INTEGER NOT NULL CHECK(numero_camera IN (1, 2)),
    resolution TEXT,
    codec TEXT,
    FOREIGN KEY (id_capteur) REFERENCES capteur(id_capteur) ON DELETE CASCADE,
    FOREIGN KEY (id_evenement) REFERENCES evenement(id_evenement) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_media_capteur ON media(id_capteur, date_media DESC);
CREATE INDEX IF NOT EXISTS idx_media_evenement ON media(id_evenement);
CREATE INDEX IF NOT EXISTS idx_media_camera ON media(numero_camera, date_media DESC);
CREATE INDEX IF NOT EXISTS idx_media_timestamp ON media(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_media_type ON media(type_media);

-- Table: notification
-- Historique des notifications envoyées
CREATE TABLE IF NOT EXISTS notification (
    id_notification INTEGER PRIMARY KEY AUTOINCREMENT,
    id_evenement INTEGER NOT NULL,
    mode TEXT NOT NULL CHECK(mode IN ('actif', 'surveillance')),
    envoyee INTEGER NOT NULL CHECK(envoyee IN (0, 1)),
    date_notification TEXT NOT NULL,
    type_notification TEXT,
    FOREIGN KEY (id_evenement) REFERENCES evenement(id_evenement) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notification_evenement ON notification(id_evenement);
CREATE INDEX IF NOT EXISTS idx_notification_date ON notification(date_notification DESC);

-- Table: configuration
-- Paramètres système
CREATE TABLE IF NOT EXISTS configuration (
    cle TEXT PRIMARY KEY,
    valeur TEXT NOT NULL,
    date_modification TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================
-- Vue: Événements récents avec médias
-- ============================================
CREATE VIEW IF NOT EXISTS vue_evenements_recents AS
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

-- ============================================
-- Trigger: Purge automatique anciens médias
-- ============================================
CREATE TRIGGER IF NOT EXISTS trigger_purge_anciens_medias
AFTER INSERT ON media
BEGIN
    -- Supprimer les médias de plus de 30 jours
    DELETE FROM media
    WHERE timestamp < (strftime('%s', 'now') - 2592000);
END;

-- ============================================
-- Données initiales: Capteurs
-- ============================================
INSERT OR IGNORE INTO capteur (id_capteur, nom_capteur, type_capteur, device_id, actif) VALUES
(1, 'PIR Entrée', 'motion', 'raspberry-1', 1),
(2, 'Tapis Salon', 'pressure', 'raspberry-1', 1),
(3, 'Bouton Arrêt', 'button', 'raspberry-1', 1),
(4, 'Caméra 1', 'camera', 'raspberry-1', 1),
(5, 'Caméra 2', 'camera', 'raspberry-1', 1);

-- ============================================
-- Configuration initiale
-- ============================================
INSERT OR REPLACE INTO configuration (cle, valeur) VALUES
('mode_systeme', 'actif'),
('duree_enregistrement', '10'),
('resolution_video', '1280x720'),
('fps_video', '30'),
('codec_video', 'h264'),
('retention_jours', '30');

-- ============================================
-- Requêtes utiles (commentées)
-- ============================================

-- Lister tous les événements récents
-- SELECT * FROM vue_evenements_recents;

-- Compter les événements par capteur (dernières 24h)
-- SELECT c.nom_capteur, COUNT(*) as nb_evenements
-- FROM evenement e
-- JOIN capteur c ON e.id_capteur = c.id_capteur
-- WHERE e.timestamp > strftime('%s', 'now') - 86400
-- GROUP BY c.id_capteur;

-- Statistiques médias
-- SELECT
--   type_media,
--   COUNT(*) as nombre,
--   SUM(taille) / 1024.0 / 1024.0 as taille_mb,
--   AVG(duree) as duree_moyenne
-- FROM media
-- GROUP BY type_media;

-- Taille totale de la base
-- SELECT page_count * page_size / 1024.0 / 1024.0 as size_mb
-- FROM pragma_page_count(), pragma_page_size();

-- ============================================
-- Maintenance
-- ============================================

-- Vérifier l'intégrité
-- PRAGMA integrity_check;

-- Compacter la base
-- VACUUM;

-- Analyser pour optimiser les requêtes
-- ANALYZE;
