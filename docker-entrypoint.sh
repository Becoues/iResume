#!/bin/sh
set -e

# Ensure runtime directories exist (volume mounts may shadow image-baked dirs)
mkdir -p "${RECORDINGS_DIR:-/app/data/recordings}"
mkdir -p /app/prisma

echo "==> Syncing database schema..."
node node_modules/prisma/build/index.js db push --skip-generate 2>&1

echo "==> Starting iResume server..."
exec node server.js
