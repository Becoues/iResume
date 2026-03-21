#!/bin/sh
set -e

# Ensure data directory exists (volume mount point)

echo "==> Syncing database schema..."
node node_modules/prisma/build/index.js db push --skip-generate 2>&1

echo "==> Starting iResume server..."
exec node server.js
