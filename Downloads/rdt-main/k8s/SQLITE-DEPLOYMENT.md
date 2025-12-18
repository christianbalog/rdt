# Déploiement SQLite avec Interface Graphique sur Kubernetes

Ce guide explique comment déployer SQLite avec une interface graphique web (sqlite-web) sur Kubernetes.

## Composants

- **SQLite Web**: Interface graphique web pour gérer les bases de données SQLite
- **PersistentVolume**: Stockage persistant pour les bases de données
- **Job d'initialisation**: Création automatique des schémas de base de données

## Architecture

```
┌─────────────────────────────────────────┐
│         SQLite Web (Port 8080)          │
│     Interface graphique navigateur      │
└──────────────────┬──────────────────────┘
                   │
         ┌─────────▼─────────┐
         │  Service K8s      │
         │  ClusterIP:8080   │
         │  NodePort:30080   │
         └─────────┬─────────┘
                   │
         ┌─────────▼─────────┐
         │   Deployment      │
         │   sqlite-web      │
         └─────────┬─────────┘
                   │
         ┌─────────▼─────────┐
         │ PersistentVolume  │
         │   /data/*.db      │
         └───────────────────┘
```

## Fichiers de Manifests

### 1. `sqlite-pvc.yaml`
PersistentVolumeClaim pour le stockage des bases de données (5Gi).

### 2. `sqlite-init-configmap.yaml`
Scripts SQL d'initialisation pour créer les schémas:
- `surveillance.db`: Tables capteur, evenement, media, configuration
- `recordings.db`: Table recordings simplifiée

### 3. `sqlite-init-job.yaml`
Job Kubernetes qui initialise les bases de données au premier déploiement.

### 4. `sqlite-web-deployment.yaml`
Deployment de l'application sqlite-web avec:
- Image: `coleifer/sqlite-web:latest`
- Port: 8080
- Volume monté: `/data`
- Health checks (liveness/readiness)

### 5. `sqlite-web-service.yaml`
Deux services:
- **ClusterIP**: Accès interne au cluster (port 8080)
- **NodePort**: Accès externe (NodePort 30080)

## Déploiement

### Étape 1: Créer le PersistentVolumeClaim

```bash
kubectl apply -f sqlite-pvc.yaml
```

Vérifier le PVC:
```bash
kubectl get pvc sqlite-pvc
```

### Étape 2: Créer le ConfigMap avec les scripts d'initialisation

```bash
kubectl apply -f sqlite-init-configmap.yaml
```

Vérifier:
```bash
kubectl get configmap sqlite-init-scripts
```

### Étape 3: Lancer le Job d'initialisation

```bash
kubectl apply -f sqlite-init-job.yaml
```

Surveiller le Job:
```bash
kubectl get job sqlite-init-job
kubectl logs job/sqlite-init-job
```

Le Job doit afficher:
```
✅ surveillance.db créée avec succès
✅ recordings.db créée avec succès
✅ Initialisation terminée
```

### Étape 4: Déployer SQLite Web

```bash
kubectl apply -f sqlite-web-deployment.yaml
```

Vérifier le déploiement:
```bash
kubectl get deployment sqlite-web
kubectl get pods -l app=sqlite-web
```

### Étape 5: Exposer le service

```bash
kubectl apply -f sqlite-web-service.yaml
```

Vérifier les services:
```bash
kubectl get svc sqlite-web
kubectl get svc sqlite-web-nodeport
```

## Accès à l'Interface Web

### Option 1: Via NodePort (accès externe)

Si vous utilisez Minikube:
```bash
minikube service sqlite-web-nodeport
```

Ou directement via l'IP du node:
```
http://<NODE_IP>:30080
```

### Option 2: Via Port-Forward (développement)

```bash
kubectl port-forward svc/sqlite-web 8080:8080
```

Puis ouvrir dans le navigateur:
```
http://localhost:8080
```

### Option 3: Via Ingress (production)

Créer un Ingress (exemple):
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: sqlite-web-ingress
spec:
  rules:
  - host: sqlite.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: sqlite-web
            port:
              number: 8080
```

## Utilisation de l'Interface

Une fois connecté à l'interface web:

1. **Sélectionner la base de données**:
   - `/data/surveillance.db` - Base principale du système de surveillance
   - `/data/recordings.db` - Base des enregistrements vidéo

2. **Fonctionnalités disponibles**:
   - Naviguer dans les tables
   - Exécuter des requêtes SQL
   - Visualiser les données
   - Exporter les résultats
   - Modifier les données (CRUD)

## Schéma des Bases de Données

### surveillance.db

**Tables:**
- `capteur`: Informations sur les capteurs (PIR, pression, bouton, caméra)
- `evenement`: Événements détectés par les capteurs
- `media`: Vidéos et photos capturées (stockées en BLOB)
- `configuration`: Configuration système

**Relations:**
```
capteur (1) ──→ (N) evenement
capteur (1) ──→ (N) media
evenement (1) ──→ (N) media
```

### recordings.db

**Tables:**
- `recordings`: Enregistrements vidéo simplifiés avec métadonnées

## Requêtes SQL Utiles

### Lister tous les événements récents
```sql
SELECT e.event_id, e.date_evenement, c.nom_capteur, c.type_capteur
FROM evenement e
JOIN capteur c ON e.id_capteur = c.id_capteur
ORDER BY e.timestamp DESC
LIMIT 50;
```

### Statistiques de détection par capteur
```sql
SELECT
    c.nom_capteur,
    c.type_capteur,
    COUNT(e.id_evenement) as nb_evenements
FROM capteur c
LEFT JOIN evenement e ON c.id_capteur = e.id_capteur
GROUP BY c.id_capteur;
```

### Taille totale des vidéos
```sql
SELECT
    COUNT(*) as nb_videos,
    SUM(taille) as taille_totale_bytes,
    ROUND(SUM(taille) / 1024.0 / 1024.0, 2) as taille_totale_mb
FROM media
WHERE type_media = 'video';
```

### Enregistrements par device
```sql
SELECT
    device_id,
    COUNT(*) as nb_enregistrements,
    ROUND(SUM(video_size) / 1024.0 / 1024.0, 2) as taille_mb
FROM recordings
GROUP BY device_id;
```

## Maintenance

### Sauvegarder les bases de données

```bash
# Récupérer le nom du pod
POD_NAME=$(kubectl get pod -l app=sqlite-web -o jsonpath='{.items[0].metadata.name}')

# Copier les bases de données localement
kubectl cp $POD_NAME:/data/surveillance.db ./backup-surveillance-$(date +%Y%m%d).db
kubectl cp $POD_NAME:/data/recordings.db ./backup-recordings-$(date +%Y%m%d).db
```

### Restaurer une sauvegarde

```bash
POD_NAME=$(kubectl get pod -l app=sqlite-web -o jsonpath='{.items[0].metadata.name}')

kubectl cp ./backup-surveillance.db $POD_NAME:/data/surveillance.db
kubectl cp ./backup-recordings.db $POD_NAME:/data/recordings.db

# Redémarrer le pod pour prendre en compte les changements
kubectl delete pod $POD_NAME
```

### Nettoyer les anciennes données

```bash
# Se connecter au pod
kubectl exec -it $POD_NAME -- sh

# Supprimer les événements de plus de 30 jours
sqlite3 /data/surveillance.db "DELETE FROM evenement WHERE timestamp < strftime('%s', 'now', '-30 days');"

# Vacuum pour récupérer l'espace
sqlite3 /data/surveillance.db "VACUUM;"
```

### Vérifier l'intégrité des bases

```bash
kubectl exec -it $POD_NAME -- sqlite3 /data/surveillance.db "PRAGMA integrity_check;"
kubectl exec -it $POD_NAME -- sqlite3 /data/recordings.db "PRAGMA integrity_check;"
```

## Monitoring

### Vérifier les ressources utilisées

```bash
kubectl top pod -l app=sqlite-web
```

### Consulter les logs

```bash
kubectl logs -f -l app=sqlite-web
```

### Vérifier l'espace disque

```bash
POD_NAME=$(kubectl get pod -l app=sqlite-web -o jsonpath='{.items[0].metadata.name}')
kubectl exec -it $POD_NAME -- df -h /data
kubectl exec -it $POD_NAME -- du -sh /data/*.db
```

## Dépannage

### Le pod ne démarre pas

```bash
kubectl describe pod -l app=sqlite-web
kubectl logs -l app=sqlite-web
```

### PVC non monté

```bash
kubectl get pvc sqlite-pvc
kubectl describe pvc sqlite-pvc
```

### Job d'initialisation échoue

```bash
kubectl logs job/sqlite-init-job
kubectl delete job sqlite-init-job
kubectl apply -f sqlite-init-job.yaml
```

### Réinitialiser complètement

```bash
# Supprimer tous les composants
kubectl delete -f sqlite-web-service.yaml
kubectl delete -f sqlite-web-deployment.yaml
kubectl delete job sqlite-init-job
kubectl delete -f sqlite-init-configmap.yaml
kubectl delete -f sqlite-pvc.yaml

# ATTENTION: Cela supprime toutes les données
# Attendre que le PVC soit complètement supprimé
kubectl get pvc

# Redéployer dans l'ordre
kubectl apply -f sqlite-pvc.yaml
kubectl apply -f sqlite-init-configmap.yaml
kubectl apply -f sqlite-init-job.yaml
kubectl apply -f sqlite-web-deployment.yaml
kubectl apply -f sqlite-web-service.yaml
```

## Sécurité

⚠️ **IMPORTANT**: Par défaut, sqlite-web n'a pas d'authentification.

### Recommandations pour la production:

1. **Ne pas exposer via NodePort en production**
   - Utiliser uniquement ClusterIP
   - Accéder via port-forward ou Ingress avec authentification

2. **Ajouter un proxy d'authentification**
   - OAuth2 Proxy
   - nginx avec basic auth
   - Ingress avec annotations d'authentification

3. **Restreindre les accès réseau**
   - NetworkPolicy pour limiter l'accès au pod
   - Firewall rules au niveau du cloud provider

4. **Sauvegardes régulières**
   - CronJob pour backups automatiques
   - Stocker les backups hors cluster

5. **Chiffrement**
   - Utiliser un StorageClass avec chiffrement
   - Considérer SQLCipher pour chiffrement de la DB

## Déploiement Rapide (Tout-en-un)

```bash
# Appliquer tous les manifests dans l'ordre
kubectl apply -f sqlite-pvc.yaml
kubectl apply -f sqlite-init-configmap.yaml
kubectl apply -f sqlite-init-job.yaml

# Attendre que le job soit complété
kubectl wait --for=condition=complete --timeout=120s job/sqlite-init-job

# Déployer l'application et le service
kubectl apply -f sqlite-web-deployment.yaml
kubectl apply -f sqlite-web-service.yaml

# Attendre que le pod soit prêt
kubectl wait --for=condition=ready --timeout=120s pod -l app=sqlite-web

# Accéder à l'interface
kubectl port-forward svc/sqlite-web 8080:8080
```

Puis ouvrir: http://localhost:8080

## Ressources

- **Image SQLite Web**: https://github.com/coleifer/sqlite-web
- **Documentation SQLite**: https://www.sqlite.org/docs.html
- **Kubernetes Persistent Volumes**: https://kubernetes.io/docs/concepts/storage/persistent-volumes/
