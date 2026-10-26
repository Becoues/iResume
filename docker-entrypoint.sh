#!/bin/sh
set -eu
node node_modules/prisma/build/index.js migrate deploy
exec node node_modules/next/dist/bin/next start --hostname "${HOSTNAME:-0.0.0.0}" --port "${PORT:-3000}"
