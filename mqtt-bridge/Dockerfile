FROM python:3.11-slim

WORKDIR /app

# Copier les dépendances et installer
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copier le script bridge
COPY mqtt-bridge.py .

# Lancer le bridge
CMD ["python", "-u", "mqtt-bridge.py"]
