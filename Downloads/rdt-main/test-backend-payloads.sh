#!/bin/bash

# Script Bash pour tester le backend avec différents payloads
# Usage: ./test-backend-payloads.sh [motion|button|pressure|all]

BACKEND_URL="http://localhost:8000/api/events"
TEST_TYPE="${1:-all}"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

send_payload() {
    local name="$1"
    local payload="$2"

    echo -e "\n${CYAN}┌─────────────────────────────────────────────────"
    echo -e "│ 🧪 Test: ${name}"
    echo -e "├─────────────────────────────────────────────────${NC}"

    response=$(curl -s -w "\n%{http_code}" -X POST "${BACKEND_URL}" \
        -H "Content-Type: application/json" \
        -d "${payload}")

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)

    if [ "$http_code" -eq 201 ] || [ "$http_code" -eq 200 ]; then
        echo -e "${GREEN}│ ✅ Succès! (HTTP $http_code)"
        echo -e "│ Réponse:"
        echo -e "│   ${body}${NC}"
    else
        echo -e "${RED}│ ❌ Erreur! (HTTP $http_code)"
        echo -e "│   ${body}${NC}"
    fi

    echo -e "${CYAN}└─────────────────────────────────────────────────${NC}\n"
}

# Générer un timestamp ISO
get_timestamp() {
    date -u +"%Y-%m-%dT%H:%M:%S.%6NZ" 2>/dev/null || date -u +"%Y-%m-%dT%H:%M:%S.000000Z"
}

# Générer un event_id unique
get_event_id() {
    echo "evt-test-$(date +%Y%m%d%H%M%S)-$1"
}

# Test 1: Détection de mouvement (PIR)
MOTION_PAYLOAD=$(cat <<EOF
{
  "type": "motion_detected",
  "device_id": "raspberry-1",
  "details": {
    "event_id": "$(get_event_id motion)",
    "source": "PIR",
    "data": {
      "gpio_pin": 17,
      "state": "HIGH"
    },
    "original_timestamp": "$(get_timestamp)",
    "mqtt_topic": "sensor/motion"
  }
}
EOF
)

# Test 2: Bouton pressé
BUTTON_PAYLOAD=$(cat <<EOF
{
  "type": "button_pressed",
  "device_id": "raspberry-1",
  "details": {
    "event_id": "$(get_event_id button)",
    "source": "Button",
    "data": {
      "gpio_pin": 23,
      "state": "PRESSED"
    },
    "original_timestamp": "$(get_timestamp)",
    "mqtt_topic": "sensor/button"
  }
}
EOF
)

# Test 3: Tapis pressé
PRESSURE_PAYLOAD=$(cat <<EOF
{
  "type": "button_pressed",
  "device_id": "raspberry-1",
  "details": {
    "event_id": "$(get_event_id pressure)",
    "source": "Pressure",
    "data": {
      "gpio_pin": 24,
      "state": "PRESSED"
    },
    "original_timestamp": "$(get_timestamp)",
    "mqtt_topic": "sensor/pressure"
  }
}
EOF
)

# Test 4: Payload minimal
MINIMAL_PAYLOAD=$(cat <<EOF
{
  "type": "motion_detected",
  "device_id": "raspberry-2",
  "details": {
    "event_id": "evt-minimal",
    "source": "Test"
  }
}
EOF
)

# Test 5: Payload invalide (champ type manquant)
INVALID_PAYLOAD=$(cat <<EOF
{
  "device_id": "raspberry-1",
  "details": {
    "event_id": "evt-invalid"
  }
}
EOF
)

echo -e "${YELLOW}═══════════════════════════════════════════════════"
echo -e "  🧪 Test des Payloads Backend"
echo -e "═══════════════════════════════════════════════════${NC}"
echo -e "${WHITE}Backend: ${BACKEND_URL}${NC}"
echo ""

# Vérifier que le backend est accessible
health_check=$(curl -s "http://localhost:8000/health")
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Backend accessible${NC}"
else
    echo -e "${RED}❌ Backend non accessible!${NC}"
    echo -e "${YELLOW}   Assurez-vous que le backend est démarré avec: cd backend && npm start${NC}"
    exit 1
fi

# Exécuter les tests selon le paramètre
case "$TEST_TYPE" in
    motion)
        send_payload "Détection de mouvement (PIR)" "$MOTION_PAYLOAD"
        ;;
    button)
        send_payload "Bouton pressé" "$BUTTON_PAYLOAD"
        ;;
    pressure)
        send_payload "Tapis pressé (Pressure)" "$PRESSURE_PAYLOAD"
        ;;
    all)
        send_payload "1️⃣ Détection de mouvement (PIR)" "$MOTION_PAYLOAD"
        sleep 1

        send_payload "2️⃣ Bouton pressé" "$BUTTON_PAYLOAD"
        sleep 1

        send_payload "3️⃣ Tapis pressé (Pressure)" "$PRESSURE_PAYLOAD"
        sleep 1

        send_payload "4️⃣ Payload minimal" "$MINIMAL_PAYLOAD"
        sleep 1

        send_payload "5️⃣ Payload invalide (doit échouer)" "$INVALID_PAYLOAD"
        ;;
    *)
        echo -e "${YELLOW}Usage: $0 [motion|button|pressure|all]${NC}"
        exit 1
        ;;
esac

echo -e "${YELLOW}═══════════════════════════════════════════════════"
echo -e "  ✅ Tests terminés!"
echo -e "═══════════════════════════════════════════════════${NC}"
echo ""
echo -e "${CYAN}💡 Pour voir les événements reçus:${NC}"
echo -e "${WHITE}   curl http://localhost:8000/api/events${NC}"
echo ""
echo -e "${CYAN}💡 Pour voir les logs du backend:${NC}"
echo -e "${WHITE}   Consultez la console où le backend s'exécute${NC}"
echo ""
