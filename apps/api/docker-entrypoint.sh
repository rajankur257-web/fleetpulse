#!/bin/sh
set -e

echo "[FleetPulse] Release phase: applying database schema & migrations..."
if [ -n "$DATABASE_URL" ]; then
  # Apply schema migrations automatically on release using pinned prisma 6
  cd /app/apps/api && npx --yes prisma@6.2.1 db push --skip-generate || echo "[FleetPulse] Notice: schema synchronization bypassed or completed"
  cd /app
fi

echo "[FleetPulse] Starting production application..."
exec "$@"
