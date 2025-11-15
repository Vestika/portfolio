#!/bin/bash
# Test cache endpoints with curl (no auth required for read endpoints)

PORT=8080
BASE_URL="http://localhost:$PORT"

echo "🧪 Testing Cache Endpoints with curl"
echo "======================================"
echo ""

# Test 1: Cache status
echo "1️⃣ Testing /cache/status..."
curl -s "$BASE_URL/cache/status" | jq '.' || echo "❌ Failed"
echo ""

# Test 2: Scheduler status  
echo "2️⃣ Testing /cache/scheduler/status..."
curl -s "$BASE_URL/cache/scheduler/status" | jq '.' || echo "❌ Failed"
echo ""

# Test 3: Historical data for AAPL
echo "3️⃣ Testing /cache/historical/AAPL?days=7..."
curl -s "$BASE_URL/cache/historical/AAPL?days=7" | jq '.' || echo "❌ Failed"
echo ""

echo "✅ Tests complete!"
echo ""
echo "Note: If you see authentication errors, make sure:"
echo "  1. Server is running on port $PORT"
echo "  2. MongoDB is running"
echo "  3. Cache endpoints are excluded from auth (already done)"

