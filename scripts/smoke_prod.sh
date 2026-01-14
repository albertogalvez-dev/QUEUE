#!/bin/bash

# Usage: ./smoke_prod.sh [BASE_URL]
# Example: ./smoke_prod.sh https://mi-vps.com/projects/queue/api

BASE_URL=${1:-"http://localhost:5150"}
echo "🔥 Smoking Testing Queue API at: $BASE_URL"

# 1. Health
echo "--------------------------------"
echo "Checking /health..."
HEALTH=$(curl -s "$BASE_URL/health")
echo "Response: $HEALTH"

if [[ "$HEALTH" == *"healthy"* ]]; then
    echo "✅ Health Check PASSED"
else
    echo "❌ Health Check FAILED"
    exit 1
fi

# 2. Public Endpoint (Display)
echo "--------------------------------"
echo "Checking /api/display..."
DISPLAY_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/display")
echo "Status: $DISPLAY_CODE"

if [ "$DISPLAY_CODE" -eq 200 ] || [ "$DISPLAY_CODE" -eq 204 ]; then
    echo "✅ Display Endpoint ACCESSIBLE"
else
    echo "❌ Display Endpoint FAILED ($DISPLAY_CODE)"
    exit 1
fi

# 3. Auth Check (Login)
echo "--------------------------------"
echo "Checking Auth (Login)..."
# Try default credentials
TOKEN_RESP=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"operador", "password":"op123"}')

if [[ "$TOKEN_RESP" == *"token"* ]]; then
    echo "✅ Login SUCCESS"
    TOKEN=$(echo $TOKEN_RESP | grep -o '"token":"[^"]*' | grep -o '[^"]*$')
    echo "Token acquired."
    
    # 4. Protected Endpoint
    echo "Checking Protected /api/queues/A..."
    QUEUE_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/queues/A")
    if [ "$QUEUE_CODE" -eq 200 ]; then
        echo "✅ Protected Endpoint ACCESSIBLE (200)"
    else
        echo "❌ Protected Endpoint FAILED ($QUEUE_CODE)"
    fi
else
    echo "⚠️ Login Failed or Auth Not Required/Configured. Response: $TOKEN_RESP"
fi

echo "--------------------------------"
echo "🏁 Smoke Test Complete"
