#!/bin/bash
# Quick script to exchange Zoho authorization code for refresh token
# Usage: ./get_token.sh YOUR_CODE_HERE

CODE=$1

if [ -z "$CODE" ]; then
    echo "Usage: ./get_token.sh YOUR_AUTHORIZATION_CODE"
    echo ""
    echo "Example:"
    echo "  ./get_token.sh 1000.abc123def456..."
    exit 1
fi

echo "Exchanging authorization code for refresh token..."
echo ""

# For EU accounts (use .eu endpoint)
curl -X POST https://accounts.zoho.eu/oauth/v2/token \
  -d "grant_type=authorization_code" \
  -d "client_id=1000.KT64LY2DPP4AG3O9U24204FCUY7ZBU" \
  -d "client_secret=a640fee5aa22c20413e751672e2d390a4f827fa154" \
  -d "redirect_uri=http://localhost" \
  -d "code=$CODE" | python3 -m json.tool

echo ""
echo ""
echo "If that doesn't work, try with https://accounts.zoho.com/oauth/v2/token (non-EU):"
curl -X POST https://accounts.zoho.com/oauth/v2/token \
  -d "grant_type=authorization_code" \
  -d "client_id=1000.KT64LY2DPP4AG3O9U24204FCUY7ZBU" \
  -d "client_secret=a640fee5aa22c20413e751672e2d390a4f827fa154" \
  -d "redirect_uri=http://localhost" \
  -d "code=$CODE" | python3 -m json.tool

