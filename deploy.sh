#!/bin/bash
set -e
cd "$(dirname "$0")"
echo "Building..."
npm run build
echo "Deploying to /var/www/quickchat/..."
rsync -av --delete dist/ /var/www/quickchat/
echo "✅ Deployed. Config check:"
head -3 /var/www/quickchat/config.json
