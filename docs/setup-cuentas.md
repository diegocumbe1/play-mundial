# Instructivo: migraciones y cuentas

> ⚠️ **Este proyecto NO usa Prisma.** Usa **Supabase con SQL plano**.
> `npx prisma migrate deploy` **no** aplica nada aquí (busca un `schema.prisma`
> que no existe). Usa el script de abajo.

## 1. Aplicar migraciones

Las migraciones son los `.sql` de `supabase/migrations/`. Se aplican con el
script del repo (idempotente, puedes correrlo varias veces):

```bash
npm run migrate          # equivale a ./scripts/migrate.sh
# te pedirá la contraseña de la BD (Supabase → Settings → Database)
```

Requiere `psql` instalado (`brew install libpq && brew link --force libpq`).
Aplica **todas** las migraciones en orden, incluidas las nuevas de rifas
(`20260720000000_tenancy`, `..010000_rifas`, `..020000_cobros`).

> Alternativa manual: copiar cada `.sql` y pegarlo en Supabase → SQL Editor.

## 2. Crear el PRIMER superadmin (una sola vez)

Es un bootstrap: como todavía no existe nadie con permisos, se siembra por
terminal. El script crea el usuario en Supabase Auth **sin correo de validación**,
un tenant y la membresía `superadmin`:

```bash
npm run seed:superadmin -- diegosoft84@gmail.com "TuPassword123" "Diego"
```

Necesita en `.env.local`: `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.
Es idempotente (si el usuario ya existe, lo reutiliza).

Luego ingresa en **`/admin/login`** con ese email + password y abre **`/superadmin`**.

## 3. Crear los demás usuarios (organizadores/owners)

**No se crean desde Supabase ni piden validación por correo.** Se crean **desde la
plataforma**:

1. Entra como superadmin a **`/superadmin`**.
2. Sección **"Nuevo organizador"** → escribe nombre, email y contraseña.
3. Al guardar, la plataforma internamente:
   - crea el usuario en Supabase Auth con `email_confirm: true` (**sin validación**),
   - crea su `tenant`,
   - le asigna la membresía `owner`,
   - deja lista su config de cobro vacía.

Ese owner ya puede entrar en `/admin/login` con su email + password y ver solo
**sus** rifas en `/admin/rifas`.

### Resumen de tu pregunta
- ¿Desde Supabase o desde la plataforma? → **Desde la plataforma.** Internamente
  ella lo crea en Supabase, sin pedir validación.
- ¿Pide validación de correo? → **No.** Se usa `email_confirm: true`.
- La **única** cuenta que se siembra por terminal es el primer superadmin (tú).

## 4. Variables de entorno relevantes

| Variable | Para qué |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | cliente Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | crear usuarios, reservas y lecturas públicas seguras |
| `POLLA_ACTIVA` | `true` = muestra el Mundial; cualquier otro valor = modo rifas |

> Los cambios en `.env.local` **no se recargan en caliente**: reinicia `next dev`.
