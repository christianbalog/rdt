FROM balenalib/raspberrypi4-64-debian:bookworm

WORKDIR /app

# Installer les dépendances système
RUN apt-get update && \
    apt-get install -y \
      python3 \
      python3-pip \
      python3-paho-mqtt \
      sqlite3 \
      libcamera-tools \
      ffmpeg \
      wget \
    && rm -rf /var/lib/apt/lists/*

# Installer libcamera-apps manuellement depuis le dépôt Raspberry Pi
# Note: libcamera-vid est maintenant dans libcamera-tools ou doit être compilé
# Pour Raspberry Pi OS, il est pré-installé

# Copier les scripts
COPY capture_service.py .
COPY surveillance_service.py .
COPY api_recordings.py .
COPY init_surveillance_db.sql .
COPY requirements.txt .

# Installer les dépendances Python
RUN pip3 install --no-cache-dir -r requirements.txt --break-system-packages

# Créer le dossier pour la base de données
RUN mkdir -p /data

# Volume pour persister la base de données
VOLUME ["/data"]

CMD ["python3", "-u", "surveillance_service.py"]
