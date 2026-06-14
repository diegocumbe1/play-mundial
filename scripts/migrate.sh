#!/usr/bin/env bash
# =============================================================================
# Aplica TODAS las migraciones de supabase/migrations en orden.
# Las migraciones son idempotentes: puedes correr esto las veces que quieras
# sin que falle, aunque ya hayas aplicado algunas a mano.
#
# Uso:
#   1) Consigue la connection string en el dashboard de Supabase:
#      Settings -> Database -> "Connection string" -> URI (Session pooler).
#      Reemplaza [YOUR-PASSWORD] por la contraseña de tu base de datos.
#   2) Córrelo de alguna de estas formas:
#      DATABASE_URL='postgresql://...' ./scripts/migrate.sh
#      ./scripts/migrate.sh 'postgresql://...'
#      ./scripts/migrate.sh          (te la pedirá de forma interactiva)
# =============================================================================
set -euo pipefail

# Ir a la raíz del repo (carpeta padre de /scripts).
cd "$(dirname "$0")/.."

MIGRATIONS_DIR="supabase/migrations"

# --- Verificar psql -----------------------------------------------------------
if ! command -v psql >/dev/null 2>&1; then
  echo "❌ No se encontró 'psql'. Instálalo con:"
  echo "     brew install libpq && brew link --force libpq"
  echo "   (o instala PostgreSQL)."
  exit 1
fi

# --- Obtener la connection string --------------------------------------------
DB_URL="${DATABASE_URL:-${1:-}}"
if [ -z "${DB_URL}" ]; then
  echo "Pega tu connection string de Supabase (Settings -> Database -> URI):"
  read -r DB_URL
fi
if [ -z "${DB_URL}" ]; then
  echo "❌ No se proporcionó la connection string."
  exit 1
fi

# --- Aplicar migraciones en orden --------------------------------------------
shopt -s nullglob
files=("$MIGRATIONS_DIR"/*.sql)
if [ ${#files[@]} -eq 0 ]; then
  echo "❌ No hay migraciones en $MIGRATIONS_DIR"
  exit 1
fi

echo "▶ Aplicando ${#files[@]} migración(es)…"
for f in "${files[@]}"; do
  echo ""
  echo "── $f"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$f"
done

echo ""
echo "✅ Migraciones aplicadas correctamente."
