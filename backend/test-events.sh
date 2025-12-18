#!/bin/bash

# Script de test pour envoyer des événements au backend
# Simule les envois depuis les Raspberry Pi

BACKEND_URL="http://localhost:8000"

echo "🧪 Test des événements backend"
echo "================================"

# Test 1: Mouvement détecté
echo ""
echo "📤 Test 1: Envoi événement motion_detected..."
curl -X POST ${BACKEND_URL}/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "type": "motion_detected",
    "device_id": "raspberry-01",
    "details": {
      "confidence": 0.95,
      "location": "entrance"
    }
  }'

sleep 2

# Test 2: Pression sur tapis
echo ""
echo ""
echo "📤 Test 2: Envoi événement button_pressed..."
curl -X POST ${BACKEND_URL}/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "type": "button_pressed",
    "device_id": "raspberry-02",
    "details": {
      "pressure": "high"
    }
  }'

sleep 2

# Test 3: Récupérer les événements
echo ""
echo ""
echo "📥 Test 3: Récupération des événements récents..."
curl ${BACKEND_URL}/api/events?limit=5

echo ""
echo ""
echo "✅ Tests terminés!"
