#!/usr/bin/env bash
# =============================================================================
# Aplica en orden las migraciones de supabase/migrations que FALTAN.
# Las ya aplicadas se anotan en `public.schema_migraciones` y se saltan.
# (Las migraciones siguen siendo idempotentes: re-correrlas no rompe nada.)
#
# No usa URI (así los caracteres especiales de la contraseña no rompen nada).
# El host se deduce de NEXT_PUBLIC_SUPABASE_URL en .env.local; la contraseña
# se pide aparte (oculta) o se toma de PGPASSWORD.
#
# Uso:
#   ./scripts/migrate.sh                 # te pide la contraseña
#   PGPASSWORD='...' ./scripts/migrate.sh
#   ./scripts/migrate.sh --baseline      # marca TODAS como aplicadas sin correrlas
#   ./scripts/migrate.sh --todas         # vuelve a correr todas (ignora el registro)
#
# Overrides opcionales (p. ej. para usar el pooler en vez de la conexión directa):
#   PGHOST=aws-0-xx.pooler.supabase.com PGUSER=postgres.<ref> ./scripts/migrate.sh
# =============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."

MODO="pendientes"
case "${1:-}" in
  --baseline) MODO="baseline" ;;
  --todas) MODO="todas" ;;
  "") ;;
  *) echo "❌ Opción desconocida: $1 (usa --baseline o --todas)"; exit 1 ;;
esac

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

# Registro de migraciones aplicadas. Con RLS y sin policies: la API pública
# (anon/authenticated) no lo ve; solo el usuario postgres de este script.
psql -q -v ON_ERROR_STOP=1 <<'SQL'
set client_min_messages = warning;
create table if not exists public.schema_migraciones (
  nombre      text primary key,
  aplicada_at timestamptz not null default now()
);
alter table public.schema_migraciones enable row level security;
SQL

aplicadas="$(psql -At -v ON_ERROR_STOP=1 -c 'select nombre from public.schema_migraciones')"

marcar() {
  psql -q -v ON_ERROR_STOP=1 -v nombre="$1" <<'SQL'
insert into public.schema_migraciones (nombre) values (:'nombre') on conflict do nothing;
SQL
}

corridas=0
for f in "${files[@]}"; do
  nombre="$(basename "$f")"
  if [ "$MODO" = "baseline" ]; then
    marcar "$nombre"
    continue
  fi
  if [ "$MODO" = "pendientes" ] && grep -qxF "$nombre" <<<"$aplicadas"; then
    continue
  fi
  echo ""
  echo "── $f"
  psql -v ON_ERROR_STOP=1 -f "$f"
  marcar "$nombre"
  corridas=$((corridas + 1))
done

echo ""
if [ "$MODO" = "baseline" ]; then
  echo "✅ ${#files[@]} migraciones marcadas como aplicadas (no se corrió ninguna)."
elif [ "$corridas" -eq 0 ]; then
  echo "✅ Nada pendiente: la base ya está al día."
else
  echo "✅ ${corridas} migración(es) aplicada(s)."
fi
