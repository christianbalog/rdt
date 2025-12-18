# 📤 Payload Envoyé au Backend

## 🎯 Endpoint Backend

**URL:** `POST http://votre-backend.com/api/events`

**Content-Type:** `application/json`

**Timeout:** 5 secondes

---

## 📋 Format Général du Payload

```json
{
  "type": "motion_detected | button_pressed",
  "device_id": "raspberry-1",
  "details": {
    "event_id": "evt-1737123456-abc123",
    "source": "PIR | Button | Pressure",
    "data": { ... },
    "original_timestamp": "2025-01-15T14:30:45.123456",
    "mqtt_topic": "sensor/motion"
  }
}
```

---

## 🔴 Cas 1: Détection de Mouvement (Motion Detected)

### Message MQTT reçu
**Topic:** `sensor/motion`

```json
{
  "event_id": "evt-1737123456-abc123",
  "device_id": "raspberry-1",
  "source": "PIR",
  "type": "MOTION_DETECTED",
  "data": {
    "gpio_pin": 17,
    "state": "HIGH"
  },
  "timestamp": "2025-01-15T14:30:45.123456"
}
```

### Payload envoyé au backend
**Endpoint:** `POST /api/events`

```json
{
  "type": "motion_detected",
  "device_id": "raspberry-1",
  "details": {
    "event_id": "evt-1737123456-abc123",
    "source": "PIR",
    "data": {
      "gpio_pin": 17,
      "state": "HIGH"
    },
    "original_timestamp": "2025-01-15T14:30:45.123456",
    "mqtt_topic": "sensor/motion"
  }
}
```

### Logs mqtt-bridge
```bash
📨 Message MQTT reçu:
   Topic: sensor/motion
   Payload: {
     "event_id": "evt-1737123456-abc123",
     "type": "MOTION_DETECTED",
     ...
   }
✅ Événement envoyé au backend: motion_detected
```

---

## 🟠 Cas 2: Bouton Pressé (Button Pressed)

### Message MQTT reçu
**Topic:** `sensor/button`

```json
{
  "event_id": "evt-1737123457-def456",
  "device_id": "raspberry-1",
  "source": "Button",
  "type": "BUTTON_PRESSED",
  "data": {
    "gpio_pin": 23,
    "state": "PRESSED"
  },
  "timestamp": "2025-01-15T14:31:12.456789"
}
```

### Payload envoyé au backend
```json
{
  "type": "button_pressed",
  "device_id": "raspberry-1",
  "details": {
    "event_id": "evt-1737123457-def456",
    "source": "Button",
    "data": {
      "gpio_pin": 23,
      "state": "PRESSED"
    },
    "original_timestamp": "2025-01-15T14:31:12.456789",
    "mqtt_topic": "sensor/button"
  }
}
```

---

## 🟡 Cas 3: Tapis Pressé (Pressure Detected)

### Message MQTT reçu
**Topic:** `sensor/pressure`

```json
{
  "event_id": "evt-1737123458-ghi789",
  "device_id": "raspberry-1",
  "source": "Pressure",
  "type": "PRESSURE_DETECTED",
  "data": {
    "gpio_pin": 24,
    "state": "PRESSED"
  },
  "timestamp": "2025-01-15T14:32:00.789012"
}
```

### Payload envoyé au backend
```json
{
  "type": "button_pressed",
  "device_id": "raspberry-1",
  "details": {
    "event_id": "evt-1737123458-ghi789",
    "source": "Pressure",
    "data": {
      "gpio_pin": 24,
      "state": "PRESSED"
    },
    "original_timestamp": "2025-01-15T14:32:00.789012",
    "mqtt_topic": "sensor/pressure"
  }
}
```

**Note:** `PRESSURE_DETECTED` est converti en `button_pressed` (même type d'action)

---

## 📊 Mapping des Types d'Événements

| Type MQTT (sensor_motion.py) | Type Backend (mqtt-bridge) | Remarque |
|------------------------------|---------------------------|----------|
| `MOTION_DETECTED` | `motion_detected` | Détection PIR |
| `BUTTON_PRESSED` | `button_pressed` | Bouton physique |
| `PRESSURE_DETECTED` | `button_pressed` | Tapis (traité comme bouton) |

**Code du mapping:**
```python
type_mapping = {
    'MOTION_DETECTED': 'motion_detected',
    'BUTTON_PRESSED': 'button_pressed',
    'PRESSURE_DETECTED': 'button_pressed',
}
```

---

## 🔍 Structure Détaillée du Payload

### Niveau 1: Racine
```json
{
  "type": string,        // Type d'événement (motion_detected, button_pressed)
  "device_id": string,   // ID du Raspberry Pi (ex: "raspberry-1")
  "details": object      // Détails de l'événement
}
```

### Niveau 2: Details
```json
{
  "event_id": string,              // UUID unique de l'événement MQTT
  "source": string,                // Source du capteur (PIR, Button, Pressure)
  "data": object,                  // Données spécifiques au capteur
  "original_timestamp": string,    // Timestamp ISO du message MQTT
  "mqtt_topic": string             // Topic MQTT d'origine
}
```

### Niveau 3: Data (dépend du capteur)

**Pour PIR (motion):**
```json
{
  "gpio_pin": 17,
  "state": "HIGH"
}
```

**Pour Bouton:**
```json
{
  "gpio_pin": 23,
  "state": "PRESSED"
}
```

**Pour Tapis (pressure):**
```json
{
  "gpio_pin": 24,
  "state": "PRESSED"
}
```

---

## 🌐 Requête HTTP Complète

### Headers
```http
POST /api/events HTTP/1.1
Host: votre-backend.com
Content-Type: application/json
Content-Length: 234
```

### Body (exemple motion)
```json
{
  "type": "motion_detected",
  "device_id": "raspberry-1",
  "details": {
    "event_id": "evt-1737123456-abc123",
    "source": "PIR",
    "data": {
      "gpio_pin": 17,
      "state": "HIGH"
    },
    "original_timestamp": "2025-01-15T14:30:45.123456",
    "mqtt_topic": "sensor/motion"
  }
}
```

### Réponse attendue
```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "success": true,
  "event": {
    "id": 123,
    "type": "motion_detected",
    "timestamp": "2025-01-15T14:30:46.000Z"
  }
}
```

---

## 🔧 Traitement Backend

Le backend (Node.js) doit recevoir ce payload et:

### 1. Valider les données
```javascript
const { type, device_id, details } = req.body;

if (!type || !device_id) {
  return res.status(400).json({ error: 'Missing required fields' });
}
```

### 2. Enregistrer l'événement
```javascript
const event = {
  id: Date.now(),
  type: type,                              // "motion_detected"
  device_id: device_id,                    // "raspberry-1"
  event_id: details.event_id,              // "evt-1737123456-abc123"
  source: details.source,                  // "PIR"
  data: details.data,                      // { gpio_pin: 17, state: "HIGH" }
  mqtt_timestamp: details.original_timestamp,
  received_at: new Date().toISOString()
};

eventsStore.push(event);
```

### 3. Émettre via WebSocket selon le type
```javascript
switch (type) {
  case 'motion_detected':
    io.emit('motion_detected', {
      device_id: device_id,
      timestamp: new Date().toISOString(),
      location: getLocationFromDeviceId(device_id),
      details: {
        event_id: details.event_id,
        source: details.source
      }
    });
    break;

  case 'button_pressed':
    io.emit('button_pressed', {
      device_id: device_id,
      timestamp: new Date().toISOString(),
      button_name: details.source
    });
    break;
}
```

### 4. Répondre au mqtt-bridge
```javascript
res.status(201).json({
  success: true,
  event: {
    id: event.id,
    type: event.type,
    timestamp: event.received_at
  }
});
```

---

## 📊 Exemples de Réponses Backend

### Succès (201 Created)
```json
{
  "success": true,
  "event": {
    "id": 1737123456789,
    "type": "motion_detected",
    "timestamp": "2025-01-15T14:30:46.123Z"
  }
}
```

### Erreur (400 Bad Request)
```json
{
  "error": "Missing required fields",
  "required": ["type", "device_id"]
}
```

### Erreur (500 Internal Server Error)
```json
{
  "error": "Failed to store event",
  "message": "Database connection failed"
}
```

---

## ⚠️ Gestion des Erreurs

### mqtt-bridge ne peut pas joindre le backend

**Scénario:** Backend cloud indisponible ou réseau down

```bash
❌ Backend inaccessible (ConnectionError)
   → Le système local MQTT continue de fonctionner
```

**Comportement:**
- ✅ `sensor_motion.py` continue de publier sur MQTT
- ✅ `surveillance_service.py` continue d'enregistrer dans SQLite
- ❌ mqtt-bridge ne peut pas envoyer au backend
- ❌ Frontend cloud ne reçoit pas les événements
- ✅ **Le système local reste fonctionnel**

**L'événement est PERDU pour le backend** (pas de retry actuellement)

### Backend répond avec erreur (≠ 201)

```bash
⚠️  Backend a répondu avec le code: 500
```

**Solutions possibles:**
1. Backend log l'erreur
2. mqtt-bridge peut retry (à implémenter)
3. Queue pour retry automatique (à implémenter)

---

## 🧪 Tester le Payload

### 1. Simuler un événement MQTT
```bash
docker compose exec mqtt-broker mosquitto_pub \
  -t 'sensor/motion' \
  -m '{
    "event_id": "test-123",
    "device_id": "raspberry-1",
    "source": "PIR",
    "type": "MOTION_DETECTED",
    "data": {"gpio_pin": 17, "state": "HIGH"},
    "timestamp": "2025-01-15T14:30:45.123456"
  }'
```

### 2. Voir les logs du bridge
```bash
docker compose logs -f mqtt-bridge
```

**Sortie attendue:**
```bash
📨 Message MQTT reçu:
   Topic: sensor/motion
   Payload: {...}
✅ Événement envoyé au backend: motion_detected
```

### 3. Tester directement le backend
```bash
curl -X POST http://localhost:8000/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "type": "motion_detected",
    "device_id": "raspberry-1",
    "details": {
      "event_id": "test-123",
      "source": "PIR",
      "data": {"gpio_pin": 17, "state": "HIGH"},
      "original_timestamp": "2025-01-15T14:30:45.123456",
      "mqtt_topic": "sensor/motion"
    }
  }'
```

**Réponse attendue:**
```json
{
  "success": true,
  "event": {
    "id": 1737123456789,
    "type": "motion_detected",
    "timestamp": "2025-01-15T14:30:46.123Z"
  }
}
```

---

## 📋 Checklist Backend

Pour que votre backend fonctionne correctement avec mqtt-bridge:

- [ ] Endpoint `POST /api/events` existe
- [ ] Accepte `Content-Type: application/json`
- [ ] Valide les champs `type` et `device_id`
- [ ] Parse `details.event_id`, `details.source`, `details.data`
- [ ] Répond avec status `201 Created` en cas de succès
- [ ] Émet les événements via WebSocket vers le frontend
- [ ] Gère les erreurs avec des codes appropriés (400, 500)
- [ ] Log les événements reçus pour debugging
- [ ] Timeout < 5 secondes (timeout du bridge)

---

## 🎯 Résumé

**Payload Minimal Requis:**
```json
{
  "type": "motion_detected",
  "device_id": "raspberry-1",
  "details": {
    "event_id": "evt-123",
    "source": "PIR",
    "mqtt_topic": "sensor/motion"
  }
}
```

**Payload Complet (avec toutes les données):**
```json
{
  "type": "motion_detected",
  "device_id": "raspberry-1",
  "details": {
    "event_id": "evt-1737123456-abc123",
    "source": "PIR",
    "data": {
      "gpio_pin": 17,
      "state": "HIGH"
    },
    "original_timestamp": "2025-01-15T14:30:45.123456",
    "mqtt_topic": "sensor/motion"
  }
}
```

✅ Payload structuré, propre et facilement extensible!
