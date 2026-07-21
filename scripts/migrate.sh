#!/usr/bin/env bash
# =============================================================================
# Aplica TODAS las migraciones de supabase/migrations en orden.
# Idempotente: puedes correrlo varias veces sin que falle.
#
# No usa URI (así los caracteres especiales de la contraseña no rompen nada).
# El host se deduce de NEXT_PUBLIC_SUPABASE_URL en .env.local; la contraseña
# se pide aparte (oculta) o se toma de PGPASSWORD.
#
# Uso:
#   ./scripts/migrate.sh                 # te pide la contraseña
#   PGPASSWORD='...' ./scripts/migrate.sh
#
# Overrides opcionales (p. ej. para usar el pooler en vez de la conexión directa):
#   PGHOST=aws-0-xx.pooler.supabase.com PGUSER=postgres.<ref> ./scripts/migrate.sh
# =============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."

MIGRATIONS_DIR="supabase/migrations"

# --- Verificar psql -----------------------------------------------------------
if ! command -v psql >/dev/null 2>&1; then
  echo "❌ No se encontró 'psql'. Instálalo: brew install libpq && brew link --force libpq"
  exit 1
fi

# --- Deducir el ref del proyecto desde .env.local -----------------------------
if [ ! -f .env.local ]; then
  echo "❌ No existe .env.local"
  exit 1
fi
SUPA_URL="$(grep -E '^NEXT_PUBLIC_SUPABASE_URL=' .env.local | cut -d= -f2- | tr -d '"' | tr -d "'")"
REF="$(printf '%s' "$SUPA_URL" | sed -E 's#https?://##; s#\.supabase\.co.*##')"
if [ -z "$REF" ]; then
  echo "❌ No pude leer el ref de NEXT_PUBLIC_SUPABASE_URL en .env.local"
  exit 1
fi

# --- Lee un valor de .env.local (sin exportarlo al entorno global) -----------
env_val() {
  grep -E "^$1=" .env.local 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'"
}

# --- Parámetros de conexión ---------------------------------------------------
# Prioridad: variable ya exportada en la shell  >  valor en .env.local  >  default.
# En .env.local puedes definir (recomendado, así corres solo `npm run migrate`):
#   SUPABASE_DB_HOST=aws-0-<region>.pooler.supabase.com
#   SUPABASE_DB_PORT=5432
#   SUPABASE_DB_USER=postgres.<ref>
#   SUPABASE_DB_PASSWORD=...
PGHOST="${PGHOST:-$(env_val SUPABASE_DB_HOST)}"
export PGHOST="${PGHOST:-db.$REF.supabase.co}"
PGPORT="${PGPORT:-$(env_val SUPABASE_DB_PORT)}"
export PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-$(env_val SUPABASE_DB_USER)}"
export PGUSER="${PGUSER:-postgres}"
export PGDATABASE="${PGDATABASE:-postgres}"

# --- Contraseña ---------------------------------------------------------------
PGPASSWORD="${PGPASSWORD:-$(env_val SUPABASE_DB_PASSWORD)}"
if [ -z "${PGPASSWORD:-}" ]; then
  printf "Contraseña de la base de datos (Supabase → Settings → Database): "
  read -rs PGPASSWORD
  echo ""
fi
export PGPASSWORD

echo "Conectando a ${PGHOST}:${PGPORT} como ${PGUSER} ..."

# --- Aplicar migraciones en orden --------------------------------------------
shopt -s nullglob
files=("$MIGRATIONS_DIR"/*.sql)
if [ ${#files[@]} -eq 0 ]; then
  echo "❌ No hay migraciones en $MIGRATIONS_DIR"
  exit 1
fi

for f in "${files[@]}"; do
  echo ""
  echo "── $f"
  psql -v ON_ERROR_STOP=1 -f "$f"
done

echo ""
echo "✅ Migraciones aplicadas correctamente."
