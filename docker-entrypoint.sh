#!/bin/sh
set -e

echo "==> Syncing database schema..."
npx prisma db push --skip-generate 2>&1

echo "==> Starting iResume server..."
exec node server.js
