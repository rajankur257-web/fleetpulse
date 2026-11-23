#!/bin/sh
set -e

echo "[FleetPulse] Release phase: applying database schema & migrations..."
if [ -n "$DATABASE_URL" ]; then
  # Apply schema migrations automatically on release
  npx prisma db push --schema=/app/apps/api/prisma/schema.prisma --skip-generate || echo "[FleetPulse] Notice: schema synchronization bypassed or completed"
fi

echo "[FleetPulse] Starting production application..."
exec "$@"
