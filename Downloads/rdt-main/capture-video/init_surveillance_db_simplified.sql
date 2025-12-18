-- ============================================
-- Script d'initialisation - surveillance.db (Structure Simplifiée)
-- Base de données pour système de surveillance
-- ============================================

-- Table: capteur (3 attributs)
-- Gestion des capteurs physiques
CREATE TABLE IF NOT EXISTS capteur (
    id_capteur INTEGER PRIMARY KEY AUTOINCREMENT,
    nom_capteur TEXT NOT NULL,
    etat_capteur INTEGER NOT NULL DEFAULT 1 CHECK(etat_capteur IN (0, 1))
);

CREATE INDEX IF NOT EXISTS idx_capteur_etat ON capteur(etat_capteur);

-- Table: evenement (3 attributs)
-- Historique des événements des capteurs
CREATE TABLE IF NOT EXISTS evenement (
    id_evenement INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    id_capteur INTEGER NOT NULL,
    FOREIGN KEY (id_capteur) REFERENCES capteur(id_capteur) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_evenement_capteur ON evenement(id_capteur);
CREATE INDEX IF NOT EXISTS idx_evenement_date ON evenement(date DESC);

-- Table: media (5 attributs)
-- Stockage des vidéos
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

-- ============================================
-- Données initiales: Capteurs
-- ============================================
INSERT OR IGNORE INTO capteur (id_capteur, nom_capteur, etat_capteur) VALUES
(1, 'PIR Entrée', 1),
(2, 'Tapis Salon', 1),
(3, 'Bouton Arrêt', 1),
(4, 'Caméra 1', 1),
(5, 'Caméra 2', 1);

-- ============================================
-- Vue: Événements récents avec capteur
-- ============================================
CREATE VIEW IF NOT EXISTS vue_evenements_recents AS
SELECT
    e.id_evenement,
    e.date,
    c.id_capteur,
    c.nom_capteur,
    c.etat_capteur,
    COUNT(m.id_media) as nb_medias
FROM evenement e
JOIN capteur c ON e.id_capteur = c.id_capteur
LEFT JOIN media m ON e.id_evenement = m.id_media
GROUP BY e.id_evenement
ORDER BY e.date DESC
LIMIT 100;

-- ============================================
-- Requêtes utiles (commentées)
-- ============================================

-- Lister tous les événements récents
-- SELECT * FROM vue_evenements_recents;

-- Compter les événements par capteur
-- SELECT c.nom_capteur, COUNT(*) as nb_evenements
-- FROM evenement e
-- JOIN capteur c ON e.id_capteur = c.id_capteur
-- GROUP BY c.id_capteur;

-- Lister les médias avec leur capteur
-- SELECT m.id_media, m.date, m.numero_camera, c.nom_capteur
-- FROM media m
-- JOIN capteur c ON m.id_capteur = c.id_capteur
-- ORDER BY m.date DESC;

-- Statistiques médias par caméra
-- SELECT numero_camera, COUNT(*) as nombre
-- FROM media
-- GROUP BY numero_camera;

-- ============================================
-- Maintenance
-- ============================================

-- Vérifier l'intégrité
-- PRAGMA integrity_check;

-- Compacter la base
-- VACUUM;

-- Analyser pour optimiser les requêtes
-- ANALYZE;
