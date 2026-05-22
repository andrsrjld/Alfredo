#!/usr/bin/env bash
set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Usage: ./scripts/migrate.sh <path-to-migration.sql>"
  echo ""
  echo "Requires DATABASE_URL env var or .env.local with DATABASE_URL"
  echo ""
  echo "Get your connection string from:"
  echo "  Supabase Dashboard → Settings → Database → Connection string (URI)"
  echo ""
  echo "Example:"
  echo '  DATABASE_URL="postgresql://postgres.xxx:pass@aws-0-region.pooler.supabase.com:6543/postgres" ./scripts/migrate.sh supabase/migrations/001_add_columns.sql'
  exit 1
fi

MIGRATION_FILE="$1"

if [ ! -f "$MIGRATION_FILE" ]; then
  echo "Error: File not found: $MIGRATION_FILE"
  exit 1
fi

if [ -z "${DATABASE_URL:-}" ]; then
  if [ -f .env.local ]; then
    DATABASE_URL=$(grep '^DATABASE_URL=' .env.local | cut -d'=' -f2- | tr -d '"' | tr -d "'")
  fi
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Error: DATABASE_URL not set. Export it or add to .env.local"
  echo ""
  echo "  export DATABASE_URL=\"postgresql://postgres.xxx:pass@host:6543/postgres\""
  echo "  ./scripts/migrate.sh $MIGRATION_FILE"
  exit 1
fi

echo "Running migration: $MIGRATION_FILE"
echo "Database: $(echo "$DATABASE_URL" | sed 's/:[^:@]*@/@/')"
echo ""

psql "$DATABASE_URL" -f "$MIGRATION_FILE"

echo ""
echo "Done."