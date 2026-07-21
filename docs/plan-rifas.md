# Plan — Vertical "Rifas" (plataforma multi-tenant)

> Documento vivo. Se actualiza al cerrar cada fase.
> Fecha de arranque: 2026-07-20. El Mundial ya terminó; esta app deja de ser una
> polla single-tenant y pasa a ser una **plataforma de rifas multi-tenant**.

## Decisiones tomadas (locked)

1. **Rifas es el foco.** La polla del Mundial se **archiva** (se oculta tras flag,
   no se borra) y más adelante se modela como un tenant archivado. No invertimos
   ahora en abstraer "polla vs rifa" como productos genéricos.
2. **La lotería entra desde el MVP (Fase 1).** No se pospone: rifa por lotería
   (Boyacá, Huila, etc.) con cifras (primeras/últimas) y auto-match de ganadores
   forma parte del primer lanzamiento. La rifa interna (sorteo propio) es el
   subconjunto simple del mismo motor.
3. **Superadmin = Diego.** Único perfil actual; ve y configura todo. Los demás
   perfiles son `owner` (organizadores), cada uno dueño de sus rifas (aislados).
4. **Monetización desde el día 1.** El superadmin cobra por las rifas con dos
   modalidades: **pago por rifa** (tarifa estándar) o **suscripción mensual**
   (varias rifas), **siempre prepago** (se reserva el costo de uso de plataforma
   antes de activar). **Capa gratuita: 1 rifa gratis por mes, máximo 2 gratis por
   usuario en total; desde la 3ra, paga.** Esto queda explícito y aplicado desde
   el primer lanzamiento.
5. **Export de imagen para redes.** Cada tenant puede exportar una imagen tipo
   flyer (grilla de números + premios + datos de pago) **actualizada con el
   estado real** (números ocupados tachados) para publicar en redes.

## Contexto reusable (lo que ya existe hoy)

- **Stack:** Next.js 16 (App Router, `app/` en raíz, alias `@/*` → `src/*`) +
  Supabase (Auth + Postgres + RLS + Realtime) + shadcn base-nova + Tailwind v4.
- **Auth admin** ya funciona: `src/lib/auth.ts` (`getUser`), protección de rutas
  `/admin` en `src/lib/supabase/proxy.ts` (renombrado de middleware en Next 16).
  ⚠️ **La RLS actual es permisiva**: cualquier usuario autenticado escribe todo.
  Hay que endurecerla con aislamiento por tenant.
- **Patrón "juega sin cuenta"** (`nombre` / `telefono` / `cliente_id` en la tabla
  `apuestas`) → es exactamente el patrón de **boletas de rifa**. Se clona.
- **Config de pago hardcodeada y global** en `src/lib/polla.ts` (`POLLA.banco`,
  llave Nequi, QR, WhatsApp) → hay que volverla **por tenant**.
- **Ya disponible y reciclable:** `xlsx` (export), `web-push` (notificaciones),
  suscripciones Realtime, modal de pago con QR/Nequi, dashboard económico.

## Restricción técnica obligatoria

Antes de escribir cualquier código, **leer `node_modules/next/dist/docs/`**
(AGENTS.md advierte que este Next 16 tiene breaking changes vs. lo conocido).
Gotchas ya documentados en el repo:
- `cookies()` y `params` son **async** (`await params`).
- `middleware.ts` → `proxy.ts` (función exportada `proxy`).
- El botón shadcn base-nova **no soporta `asChild`** (usar `buttonVariants()` o
  el prop `render`).

---

## Modelo de datos (Supabase)

### Tenancy / identidad
- **`tenants`** — organizador. `id`, `nombre`, `slug`, `estado`
  (`activo` | `archivado`), `created_at`.
- **`memberships`** — vincula `auth.users` ↔ `tenant`. `user_id`, `tenant_id`,
  `rol` (`superadmin` | `owner`). El `superadmin` bypassa el aislamiento.
- **`tenant_pago_config`** — **reemplaza `POLLA.banco`**. Por tenant:
  `nequi_llave`, `titular`, `qr_url`, `whatsapp`, `mensaje_qr`. Cada tenant
  configura sus propios datos de cobro.

### Dominio rifa
- **`rifas`** — `id`, `tenant_id`, `nombre`, `descripcion`,
  `tipo` (`interna` | `loteria`),
  `estado` (`borrador` → `activa` → `cerrada` → `sorteada` → `pagada` | `cancelada`),
  `precio_boleta`, `cantidad_numeros` (ej. 100 = `00`–`99`),
  `formato_cifras` (2 | 3), `slug_publico`,
  `fecha_apertura`, `fecha_cierre`, `fecha_sorteo`.
  Para `tipo = loteria`: `loteria` (Boyacá, Huila…), `fecha_loteria`,
  `modo_cifras` (`primeras_dos` | `ultimas_dos` | `ambas`).
  Regla de juego: `solo_pagadas_juegan` (bool, default true).
- **`premios`** — `id`, `rifa_id`, `tipo` (`valor` | `producto`),
  `descripcion`, `valor` (nullable si es producto), `cantidad_ganadores`,
  `criterio` (para lotería: `primeras_2` | `ultimas_2`; para interna: `null`).
  → resuelve "los de las primeras 2 ganan tanto, los de las últimas 2 ganan
  tanto" y "premio por valor, o producto(s), o cantidad de ganadores".
- **`boletas`** — corazón del módulo financiero (clon conceptual de `apuestas`):
  `id`, `rifa_id`, `tenant_id`, `numero`,
  `estado` (`libre` | `reservado` | `pagado`),
  `comprador_nombre`, `comprador_telefono`, `cliente_id`,
  `metodo_pago`, `nota`, `pagado_at`, `consentimiento_datos` (bool), `created_at`.
- **`ganadores`** — `id`, `rifa_id`, `premio_id`, `numero`, `boleta_id`,
  `mensaje_felicitacion`, `publicado` (bool).
  La vista pública **enmascara**: "ganó el número 56 — Di\*\*\*\* Cu\*\*\*".

### Aislamiento (RLS) — crítico: hay dinero y datos personales
- `tenant_id` en todas las tablas del dominio.
- **Owner:** solo lee/escribe filas de su(s) tenant(s) (vía `memberships`).
- **Superadmin:** ve/escribe todo (policy con bypass por rol).
- **`anon` (público):** solo lee la **proyección pública segura** de una rifa por
  `slug_publico` (grilla de números ocupado/libre, conteo, ganadores
  enmascarados) y puede **reservar** un número (insert de `boleta` en `reservado`
  con nombre/teléfono/consentimiento). Espeja cómo hoy los participantes juegan
  la polla sin cuenta.

### Lógica de lotería (auto-match)
Result de lotería es un número (ej. `1234`). Con `formato_cifras = 2`:
- `primeras_2 = 12`, `ultimas_2 = 34`.
- El número `12` gana el premio con `criterio = primeras_2`; el `34` gana el de
  `ultimas_2`. `modo_cifras = ambas` paga los dos criterios.
- Al ingresar el resultado en backoffice → se resuelven `ganadores`
  automáticamente cruzando `boletas` pagadas (si `solo_pagadas_juegan`).
- Núcleo puro y testeable (patrón ya usado en `calcularDetalle()` de FlashScore).

---

## Fases

### Fase 0 · Cimientos (habilita todo lo demás)
- Migraciones: `tenants`, `memberships`, `tenant_pago_config` + `tenant_id` y RLS
  en el dominio rifa.
- Crear al superadmin (Diego) y helper de rol/tenant en servidor.
- Sustituir `POLLA.banco` por lectura de `tenant_pago_config`.
- **Ocultar el Mundial** tras flag `POLLA_ACTIVA=false`: oculta/redirige
  `/jugar`, `/resultados`, `/comunidad` y cambia el home hacia la nueva vertical.
  Sin borrar datos.

### Fase 1 · Rifa (MVP vendible — incluye lotería)
- **Backoffice owner** (`/admin/rifas`, `/admin/rifas/[id]`): CRUD de rifa,
  config de tipo (interna | lotería), cifras, precio, cantidad de números,
  fechas, premios (valor/producto, cantidad de ganadores, criterio).
- **Grilla de números**: reservar / marcar (emoji o tachado al elegirse),
  estados libre/reservado/pagado.
- **Enlace público** `/r/[slug]`: grilla en **tiempo real** (cuántos libres),
  reservar sin cuenta, **sin datos sensibles**. Realtime scoped a la rifa.
- **Dashboard financiero**: pagó / debe, totales, % de cumplimiento, cuántas
  faltan por vender, editar "ya pagó", export xlsx.
- **Sorteo**:
  - Interna: sorteo manual → ganador.
  - Lotería: ingresar resultado → **auto-match** por primeras/últimas cifras.
  - Ganador enmascarado + mensaje de felicitación.
- Regla "**boleta no pagada no juega**" aplicada en el match.

### Fase 2 · Pulido de plataforma
- Políticas y **tratamiento de datos** + consentimiento explícito en la reserva.
- Aviso/notificación "las boletas no pagadas no entran en juego".
- Notificaciones (web-push ya está integrado).
- Onboarding de nuevos owners (superadmin crea tenant + invita owner).
- `/superadmin`: gestión de tenants (solo Diego).

---

## Rutas nuevas
- `/admin/rifas`, `/admin/rifas/[id]` — backoffice del owner.
- `/superadmin` — gestión de tenants (solo superadmin).
- `/r/[slug]` — enlace público de la rifa (grilla en vivo, ganadores enmascarados).

## Privacidad / cumplimiento
- Enmascarar nombres en vistas públicas (`Di**** Cu***`).
- Nunca exponer teléfono, estado de pago ni monto en vistas públicas.
- **Público = solo `libre` u `ocupado`.** La distinción `reservado` (sin pagar)
  vs `pagado` es **info interna del admin del tenant**; afuera NUNCA se revela
  quién no ha pagado. Aplica a la grilla pública `/r/[slug]` **y** al flyer
  exportado. → `getRifaPublica()` colapsa `reservado`+`pagado` → `ocupado`
  (el `BoletaPublica` público expone `numero` + `ocupado:boolean`, no el estado
  real). La grilla de 3 estados vive solo en el backoffice del owner.
- Consentimiento de tratamiento de datos al reservar; página de política
  (extender `/terminos`).

## Monetización, planes y capa gratuita

### Costo real de plataforma (nuestro costo a cubrir)
| Servicio | Free | Al monetizar | Fuente |
|---|---|---|---|
| Supabase | 2 proyectos / 500MB / 50k usuarios / 200 realtime | Pro **$25 USD/mes** | supabase.com/pricing |
| Vercel | Hobby (solo **no-comercial**) | Pro **$20 USD/mes** (1TB) | makerkit.dev |
| **Piso comercial** | — | **≈ $45 USD/mes (~$180.000 COP)** fijos | — |

Referencia de competidores: Club de Rifas (50 ventas gratis + pago por activar
talonario, sin comisión ni suscripción), LAOOZ ($29 USD pago único), RifaYa
(freemium por app). El patrón dominante es **pago por rifa**; nosotros ofrecemos
las dos modalidades.

### Modelo de precios (montos POR DEFINIR por Diego)
> ⚠️ **Los montos exactos los define el superadmin (Diego); aún pendientes.** Se
> guardan como configuración editable (no hardcodeados). Cifras abajo = solo
> referencia para dimensionar (1 USD ≈ 4.000 COP; piso de plataforma ≈ $180k COP/mes).

- **Gratis** — 1 rifa/mes, **máx. 2 en total por usuario**, y **solo grillas de
  ≤100 números** (rifas más grandes exigen pago, sin importar la cuota). El flyer
  de export lleva **marca de agua** "Hecho con [Plataforma]". Desde la 3ra rifa
  (o una 2da en el mismo mes) → hay que pagar.
- **Pago por rifa** — tarifa plana **prepago al activar** (rifa en `borrador`
  hasta confirmar el pago). Sin marca de agua. _Monto por definir_ (ref. sugerida:
  ~$15.000 ≤100 núm / ~$25.000 hasta 500).
- **Suscripción mensual** — rifas ilimitadas, sin marca de agua, export en alta,
  soporte. **Siempre anticipado**; al vencer, las rifas activas siguen pero no
  puede crear nuevas hasta renovar. _Monto por definir_ (ref. sugerida: ~$39.900/mes).

Break-even ≈ 5 suscriptores o ~12 rifas pagas/mes cubren el piso de $180k COP.
La validación de tamaño (≤100 en gratis) va en `activarRifa` junto a la cuota.

### Cobro (mecánica)
- **MVP (día 1): prepago manual.** El owner transfiere al superadmin (Nequi) y el
  superadmin **confirma el cobro** → se activa la rifa / se extiende la
  suscripción. Sin pasarela: cero fricción para arrancar.
- **Futuro:** automatizar con **Wompi** (pasarela colombiana; también Mercado
  Pago) para cobro/renovación self-service.

### Precios editables desde el backoffice (setting del superadmin)
**Los montos y las reglas del free NO se hardcodean.** Viven en una tabla de
configuración de plataforma (`plataforma_config`, fila única) que el superadmin
edita en `/superadmin/settings`: precio por rifa (por tamaño), precio de
suscripción, moneda, y los parámetros de la capa gratuita (rifas gratis/mes,
total, máx. números). Todo lo que consulte precios/cuota **lee de ahí**. Ver
Anexo B2 y el mapa de rutas.

### Soporte en datos (ver Anexo B2)
- `plataforma_config` (editable por superadmin): precios y reglas del free.
- Tenant: `plan_actual` (`gratis` | `pago_rifa` | `suscripcion`),
  `suscripcion_vence_at`.
- Rifa: `cobro_tipo` (cómo se pagó esta rifa) + `activada_at`.
- Tabla `cobros` (ledger): quién, tipo, monto, estado (`pendiente` | `pagado`),
  rifa asociada, periodo, comprobante.
- Función de cuota `puede_crear_gratis(tenant)`: permite si (rifas gratis de por
  vida < límite total) **y** (ninguna rifa gratis este mes) — los límites salen
  de `plataforma_config`. La validación vive en el server action `activarRifa`,
  no solo en la UI.

## Export de imagen para redes (flyer dinámico)

Objetivo: que el owner genere una imagen tipo la del flyer de referencia (grilla
1–100, premios, "valor del número", alias/QR de pago, título) **con el estado
real** de la rifa — números ocupados tachados/atenuados, cuántos quedan libres —
para publicar y compartir. Se actualiza porque lee las `boletas` en vivo.

- **Técnica recomendada:** `ImageResponse` de `next/og` (Satori, ya viene con
  Next; sin dependencia pesada) en una route `app/r/[slug]/flyer/route.tsx` que
  renderiza JSX → **PNG**. Alternativa cliente: `html-to-image`/canvas si se
  quiere previsualización editable. ⚠️ Verificar el uso exacto de `ImageResponse`
  en los docs de Next 16 antes de codear.
- **Contenido:** título/nombre de la rifa, grilla con estado (libre / ocupado
  tachado), lista de premios, precio por número, datos de pago del tenant
  (`tenant_pago_config`), fecha de sorteo / lotería.
- **Monetización cruzada:** en plan **Gratis** el PNG lleva marca de agua "Hecho
  con [Plataforma]" (marketing viral gratis); planes pagos la quitan y exportan
  en alta.
- **Botón** "Exportar imagen" en el backoffice (`/admin/rifas/[id]`) y opción de
  compartir desde el enlace público `/r/[slug]`.

### Mejoras sobre el flyer actual (referencia real de Diego)
Referencia: "Súper rifa de solidaridad", juega 19 ago, valor $20.000, grilla
00–99 con 🙃 en los ocupados, lotería de Manizales, premio $1.000.000. Qué
mantener y qué mejorar (lente `brand-ux-ventas`):

- ✅ **Mantener:** formato story vertical, título grande, banner con fecha+valor,
  premio destacado abajo, mención de la lotería. Se ve festivo y compartible.
- 🔴 **No ocultar el número al ocuparse.** Hoy el emoji tapa el número → nadie
  puede verificar cuál está tomado. Mejor: **número siempre visible** + marca de
  estado encima (atenuado + tachado). Confianza y verificación. (Aplica también
  a la grilla web `grilla-numeros.tsx`.)
- 🔴 **Falta cómo comprar.** El flyer no dice cómo pagar ni a quién escribir.
  Agregar **datos de pago del tenant** (Nequi/alias/QR) + **WhatsApp** de contacto.
  Sin CTA no hay conversión.
- 🟡 **Escasez real:** agregar contador "**Quedan 63 de 100**" + barra de avance.
- 🟡 **Regla de la lotería explícita:** "gana con las **últimas 2 cifras** de la
  Lotería de Manizales del 19 ago" (claridad = confianza; sale del `modo_cifras`).
- 🟡 **Número ocupado con marca clara** (atenuado + tachado), pero en el flyer y
  la grilla pública es **un solo estado "ocupado"** — la diferencia `reservado`
  (sin pagar) vs `pagado` es **solo para el admin** (ver Privacidad). Los 3
  estados con ⏳/✅ solo aparecen en el backoffice del owner.
- 🟢 **Ventaja de plataforma sobre la imagen estática:** incluir **QR / link corto
  a `/r/[slug]`** para que la gente vea la disponibilidad **en vivo** (la imagen
  es una foto; el link se actualiza solo). Este es el diferencial vs. un flyer de
  Canva.
- 🟢 **Premios múltiples** si aplica (1°/2°/3°), no solo uno.
- 🟢 **Legibilidad y contraste** del título/números (AA); marca de agua discreta
  en plan gratis.

## Marca, UX/UI y conversión (enfoque transversal)

> **Al diseñar cualquier pantalla de esta vertical, invocar la skill
> `brand-ux-ventas`** (experto en UX/UI + branding + ventas por internet). No es
> una fase aparte: es el lente con el que se construye todo lo público y de venta.

Prioridad de diseño (en orden): **confianza → conversión → difusión**.
- **Marca madre** de la plataforma (nombre, tagline, tono, tokens) + **co-branding**
  con el tenant (el owner es la estrella en su página; la plataforma firma
  discreta → marca de agua en gratis = difusión).
- **Mobile-first** real: el tráfico entra por WhatsApp/Instagram desde el celular.
- La **página pública `/r/[slug]` es un embudo**, no una planilla: premio y
  promesa arriba, escasez real ("quedan 37/100"), reserva en 1–2 pasos, pago
  claro, prueba social (ganadores enmascarados), botón de compartir prominente.
- El **flyer exportable** se diseña como pieza compartible bella (story 1080×1920
  y cuadrado 1080×1080), no como screenshot de la grilla.
- **Página de precios** con 3 planes, el recomendado destacado, precios traídos
  de `plataforma_config`; ofrecer el upgrade **en el momento** en que el owner
  topa el límite gratis.
- Un CTA primario por pantalla; estados vacío/error en lenguaje humano;
  accesibilidad AA; todo desde tokens (sin colores sueltos).

## Riesgos / cosas a validar
- Endurecer la RLS actual sin romper el flujo público de reserva.
- Índice único `(rifa_id, numero)` para no vender el mismo número dos veces
  (carrera en reservas concurrentes → constraint + manejo de conflicto).
- Confirmar formato real del resultado de cada lotería (nº de cifras) antes de
  cablear el auto-match.

---

# Anexo técnico (para ejecutar)

> Bocetos concretos. Al codear cada migración: **leer primero los docs de Next 16**
> y mantener el estilo idempotente de las migraciones existentes
> (`do $$ ... end $$`, `create table if not exists`, `drop policy if exists`).

## A. DDL — Fase 0 (tenancy)

Archivo: `supabase/migrations/20260720000000_tenancy.sql`

```sql
-- Enums
do $$
begin
  if not exists (select 1 from pg_type where typname = 'rol_membership') then
    create type public.rol_membership as enum ('superadmin', 'owner');
  end if;
  if not exists (select 1 from pg_type where typname = 'estado_tenant') then
    create type public.estado_tenant as enum ('activo', 'archivado');
  end if;
end $$;

create table if not exists public.tenants (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  slug       text unique not null,
  estado     public.estado_tenant not null default 'activo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memberships (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  tenant_id  uuid not null references public.tenants (id) on delete cascade,
  rol        public.rol_membership not null default 'owner',
  created_at timestamptz not null default now(),
  unique (user_id, tenant_id)
);

create table if not exists public.tenant_pago_config (
  tenant_id   uuid primary key references public.tenants (id) on delete cascade,
  nequi_llave text,
  titular     text,
  qr_url      text,
  whatsapp    text,
  mensaje_qr  text,
  updated_at  timestamptz not null default now()
);

-- Helpers de RLS (SECURITY DEFINER para poder leer memberships sin recursión)
create or replace function public.es_superadmin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid() and m.rol = 'superadmin'
  );
$$;

create or replace function public.es_miembro(t uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.es_superadmin() or exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid() and m.tenant_id = t
  );
$$;
```

## B. DDL — Fase 1 (dominio rifa)

Archivo: `supabase/migrations/20260720010000_rifas.sql`

```sql
do $$
begin
  if not exists (select 1 from pg_type where typname = 'tipo_rifa') then
    create type public.tipo_rifa as enum ('interna', 'loteria');
  end if;
  if not exists (select 1 from pg_type where typname = 'estado_rifa') then
    create type public.estado_rifa as enum
      ('borrador','activa','cerrada','sorteada','pagada','cancelada');
  end if;
  if not exists (select 1 from pg_type where typname = 'modo_cifras') then
    create type public.modo_cifras as enum ('primeras_dos','ultimas_dos','ambas');
  end if;
  if not exists (select 1 from pg_type where typname = 'estado_boleta') then
    create type public.estado_boleta as enum ('libre','reservado','pagado');
  end if;
  if not exists (select 1 from pg_type where typname = 'criterio_premio') then
    create type public.criterio_premio as enum ('primeras_2','ultimas_2');
  end if;
end $$;

create table if not exists public.rifas (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants (id) on delete cascade,
  nombre             text not null,
  descripcion        text,
  tipo               public.tipo_rifa not null default 'interna',
  estado             public.estado_rifa not null default 'borrador',
  precio_boleta      integer not null check (precio_boleta >= 0),
  cantidad_numeros   integer not null check (cantidad_numeros > 0),
  formato_cifras     integer not null default 2 check (formato_cifras in (2,3)),
  solo_pagadas_juegan boolean not null default true,
  slug_publico       text unique not null,
  -- lotería:
  loteria            text,
  fecha_loteria      date,
  modo_cifras        public.modo_cifras,
  resultado_loteria  text,      -- se llena al ingresar el sorteo
  fecha_apertura     timestamptz,
  fecha_cierre       timestamptz,
  fecha_sorteo       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists public.premios (
  id                 uuid primary key default gen_random_uuid(),
  rifa_id            uuid not null references public.rifas (id) on delete cascade,
  tipo               text not null check (tipo in ('valor','producto')),
  descripcion        text not null,
  valor              integer,   -- null si es producto
  cantidad_ganadores integer not null default 1 check (cantidad_ganadores > 0),
  criterio           public.criterio_premio  -- null en rifa interna
);

create table if not exists public.boletas (
  id                  uuid primary key default gen_random_uuid(),
  rifa_id             uuid not null references public.rifas (id) on delete cascade,
  tenant_id           uuid not null references public.tenants (id) on delete cascade,
  numero              integer not null,
  estado              public.estado_boleta not null default 'libre',
  comprador_nombre    text,
  comprador_telefono  text,
  cliente_id          text,
  metodo_pago         text check (metodo_pago is null or metodo_pago in ('efectivo','transferencia')),
  nota                text,
  consentimiento_datos boolean not null default false,
  pagado_at           timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (rifa_id, numero)          -- ← evita vender dos veces el mismo número
);

create table if not exists public.ganadores (
  id                   uuid primary key default gen_random_uuid(),
  rifa_id              uuid not null references public.rifas (id) on delete cascade,
  premio_id            uuid not null references public.premios (id) on delete cascade,
  boleta_id            uuid references public.boletas (id) on delete set null,
  numero               integer not null,
  mensaje_felicitacion text,
  publicado            boolean not null default false,
  created_at           timestamptz not null default now()
);
```

## B2. DDL — Planes y cobros (Fase 1, monetización)

Archivo: `supabase/migrations/20260720020000_cobros.sql`

```sql
do $$
begin
  if not exists (select 1 from pg_type where typname = 'plan_tenant') then
    create type public.plan_tenant as enum ('gratis','pago_rifa','suscripcion');
  end if;
  if not exists (select 1 from pg_type where typname = 'estado_cobro') then
    create type public.estado_cobro as enum ('pendiente','pagado','anulado');
  end if;
end $$;

-- Config de plataforma EDITABLE por el superadmin (fila única). Nada de precios
-- ni reglas del free hardcodeados: todo se lee de aquí.
create table if not exists public.plataforma_config (
  id                     boolean primary key default true check (id),  -- fuerza 1 fila
  moneda                 text not null default 'COP',
  precio_rifa_100        integer not null default 0,   -- rifa hasta 100 números
  precio_rifa_500        integer not null default 0,   -- rifa 101–500 números
  precio_suscripcion_mes integer not null default 0,
  free_rifas_por_mes     integer not null default 1,
  free_rifas_total       integer not null default 2,
  free_max_numeros       integer not null default 100,
  updated_at             timestamptz not null default now()
);
insert into public.plataforma_config (id) values (true)
  on conflict (id) do nothing;

alter table public.tenants
  add column if not exists plan_actual public.plan_tenant not null default 'gratis',
  add column if not exists suscripcion_vence_at timestamptz;

alter table public.rifas
  add column if not exists cobro_tipo public.plan_tenant,  -- cómo se pagó ESTA rifa
  add column if not exists activada_at timestamptz;

create table if not exists public.cobros (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  rifa_id     uuid references public.rifas (id) on delete set null,
  tipo        public.plan_tenant not null,       -- pago_rifa | suscripcion
  monto       integer not null check (monto >= 0),
  estado      public.estado_cobro not null default 'pendiente',
  periodo     text,                              -- 'YYYY-MM' para suscripción
  comprobante text,                              -- nota/URL del pago manual
  created_at  timestamptz not null default now(),
  pagado_at   timestamptz
);

-- Cuota de capa gratuita: límites tomados de plataforma_config (editables).
create or replace function public.puede_crear_gratis(t uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select (
    (select count(*) from public.rifas r
       where r.tenant_id = t and r.cobro_tipo = 'gratis')
    < (select free_rifas_total from public.plataforma_config)
  ) and (
    (select count(*) from public.rifas r
       where r.tenant_id = t and r.cobro_tipo = 'gratis'
         and date_trunc('month', r.activada_at) = date_trunc('month', now()))
    < (select free_rifas_por_mes from public.plataforma_config)
  );
$$;
```

> `plataforma_config`: lectura pública/miembro (para pintar precios); **escritura
> solo superadmin**. `cobros` y planes: lectura del miembro del tenant; escritura
> solo superadmin (`es_superadmin()`), porque confirmar un pago y fijar precios
> son acciones del dueño de la plataforma.
> El límite de tamaño gratis (`free_max_numeros`) también se valida en
> `activarRifa` (una rifa gratis con más números que ese tope exige pago).

## C. RLS (patrón por tabla del dominio)

```sql
alter table public.rifas   enable row level security;
alter table public.boletas enable row level security;
-- ...premios, ganadores, tenants, memberships, tenant_pago_config

-- Owner/superadmin: acceso total a lo de su tenant
create policy "rifas_tenant_rw" on public.rifas
  for all to authenticated
  using (public.es_miembro(tenant_id))
  with check (public.es_miembro(tenant_id));

-- Público: lee solo rifas activas (la proyección segura se arma en el server
-- action, que NO selecciona teléfono/estado de pago).
create policy "rifas_public_select" on public.rifas
  for select to anon
  using (estado in ('activa','cerrada','sorteada','pagada'));

-- Boletas: público puede leer (para pintar la grilla ocupado/libre) e insertar
-- una reserva; NO puede actualizar ni marcar pago. El corte de campos sensibles
-- lo hace el server action (nunca se exponen nombre/teléfono al anon).
create policy "boletas_public_select" on public.boletas
  for select to anon using (true);
create policy "boletas_public_insert" on public.boletas
  for insert to anon with check (estado = 'reservado');
create policy "boletas_tenant_rw" on public.boletas
  for all to authenticated
  using (public.es_miembro(tenant_id))
  with check (public.es_miembro(tenant_id));

-- Realtime
alter publication supabase_realtime add table public.boletas;
```

> ⚠️ Nota de privacidad: aunque la RLS deja al `anon` leer `boletas`, la vista
> pública **nunca** debe seleccionar `comprador_nombre`/`telefono`/`metodo_pago`
> **ni el `estado` real**. El server action `getRifaPublica()` devuelve
> `numero` + `ocupado:boolean` (colapsa `reservado`+`pagado` → `ocupado`), así el
> público no distingue quién no ha pagado. Si se quiere blindar a nivel DB, se
> expone una **vista** con columnas recortadas (sin `estado`) y se da el `select`
> al `anon` solo sobre esa vista.

## D. Tipos TypeScript (nuevos, en `src/types/index.ts`)

`Tenant`, `Membership`, `TenantPagoConfig`, `Rifa`, `Premio`, `Boleta`,
`Ganador`, y cortes públicos `BoletaPublica` (`numero` + `ocupado:boolean`, **sin
el estado real** para no revelar pago) y `GanadorPublico` (número + nombre
enmascarado). Espejan el par `Apuesta` / `ApuestaCliente` ya existente.

## E. Config y helpers a tocar
- `src/lib/polla.ts` → extraer un `getPagoConfig(tenantId)` que lea
  `tenant_pago_config` en vez del `POLLA.banco` fijo. Dejar `POLLA` solo para el
  Mundial archivado.
- `src/lib/auth.ts` → añadir `getMembership()` / `getTenantActual()` /
  `esSuperadmin()`.
- `src/lib/supabase/proxy.ts` → proteger `/superadmin` (solo rol superadmin) y
  `/admin/rifas` (miembro). Redirección de rutas del Mundial si `POLLA_ACTIVA=false`.
- `src/lib/rifa.ts` (nuevo) → núcleo **puro y testeable**: `resolverGanadores(rifa,
  premios, boletas, resultadoLoteria)` y métricas del dashboard
  (`vendidas`, `pagadas`, `pendientes`, `recaudado`, `pctCumplimiento`,
  `faltanPorVender`). Mismo estilo que `calcularResultadoPartido`.

## F. Rutas y componentes (mapa)

| Ruta / archivo | Reusa de |
|---|---|
| `app/admin/rifas/page.tsx` (lista) | patrón de `app/admin/page.tsx` |
| `app/admin/rifas/[id]/page.tsx` (detalle + dashboard financiero) | secciones/stats de `admin/page.tsx` |
| `app/superadmin/page.tsx` (tenants) | nuevo, simple |
| `app/superadmin/settings/page.tsx` (editar precios y reglas del free) | form → `plataforma_config` |
| `app/precios/page.tsx` (página pública de planes) | lee `plataforma_config` |
| `app/r/[slug]/page.tsx` (público, grilla en vivo) | `PublicCommunityScores` + Realtime |
| `app/r/[slug]/flyer/route.tsx` (PNG dinámico para redes) | `next/og` `ImageResponse` |
| `src/actions/rifas.ts` | espejo de `src/actions/apuestas.ts` |
| `src/actions/tenants.ts` | nuevo |
| `src/actions/cobros.ts` (cuota + confirmar pago, solo superadmin) | nuevo |
| `src/components/rifa/grilla-numeros.tsx` | nuevo |
| `src/components/rifa/reserva-modal.tsx` | `apuestas-pago-modal.tsx` |
| `src/components/rifa/pago-toggle.tsx` | `admin/pago-toggle.tsx` |
| `src/components/rifa/dashboard-financiero.tsx` | stats de `admin/page.tsx` |

### Server actions `src/actions/rifas.ts` (espejo de `apuestas.ts`)
`crearRifa`, `actualizarRifa`, `getRifas` (del tenant), `getRifa(id)`,
`getRifaPublica(slug)` (corte seguro), `reservarNumero` (anon),
`marcarPagoBoleta`, `liberarBoleta`, `ingresarResultadoLoteria` (→ auto-match),
`getDashboard(rifaId)`, `exportarXlsx(rifaId)`.
`activarRifa(rifaId)` → **valida cuota/plan** (`puede_crear_gratis` o suscripción
vigente); si no aplica gratis, crea `cobro` pendiente y deja la rifa en
`borrador` hasta que el superadmin confirme. En `cobros.ts` (solo superadmin):
`confirmarCobro(cobroId)` → marca `pagado`, activa la rifa o extiende
`suscripcion_vence_at`.

## G. Env nuevas
```
# Feature flag: oculta/redirige el Mundial (polla) ya terminado.
POLLA_ACTIVA=false
```

---

# Estado de implementación (2026-07-21)

**Código escrito y `next build` en verde.** Falta lo que NO se hace desde el repo:

- [ ] **Aplicar las 3 migraciones** en Supabase (`20260720000000_tenancy.sql`,
      `..010000_rifas.sql`, `..020000_cobros.sql`).
- [ ] **Seed del superadmin**: crear el usuario en Supabase Auth + fila en
      `tenants` + `memberships` (rol `superadmin`) para Diego.
- [ ] **Env**: definir `POLLA_ACTIVA` y `SUPABASE_SERVICE_ROLE_KEY` en el entorno.
- [ ] **Fijar precios** reales en `/superadmin/settings` (hoy en 0).
- [ ] Pendientes menores: export xlsx del dashboard (dep `xlsx` ya está), y
      endurecer "en vivo" (hoy la pública refresca por polling cada 20s + al
      enfocar; realtime directo quedó fuera por privacidad de `boletas`).

Archivos creados: migraciones SQL; `src/lib/rifa.ts`, `src/lib/tenant-config.ts`;
tipos en `src/types/index.ts`; helpers en `src/lib/auth.ts`; `src/actions/rifas.ts`,
`tenants.ts`, `cobros.ts`; backoffice `app/admin/rifas/**`; público
`app/r/[slug]/**` (+ flyer); `app/superadmin/**`; `app/precios`; componentes en
`src/components/rifa/**` y `src/components/superadmin/**`.

# Checklists

## Fase 0 · Cimientos
- [ ] Leer `node_modules/next/dist/docs/` (routing, RSC, server actions, proxy).
- [ ] Definir la **marca madre** (nombre, tagline, tokens de color/tipografía)
      con la skill `brand-ux-ventas` antes de construir pantallas públicas.
- [ ] Migración `tenancy.sql` (tenants, memberships, tenant_pago_config, helpers).
- [ ] RLS de las tablas de tenancy.
- [ ] Crear tenant + membership `superadmin` para Diego (script/seed).
- [ ] Helpers en `src/lib/auth.ts` (`esSuperadmin`, `getTenantActual`).
- [ ] `getPagoConfig(tenantId)` reemplaza `POLLA.banco`.
- [ ] Flag `POLLA_ACTIVA=false` + redirección en `proxy.ts` de `/jugar`,
      `/resultados`, `/comunidad`; home apunta a la vertical de rifas.
- [ ] Verificar build de prod (`next build`).

## Fase 1 · Rifa (MVP con lotería)
- [ ] Migración `rifas.sql` (rifas, premios, boletas, ganadores) + índice único
      `(rifa_id, numero)` + Realtime en `boletas`.
- [ ] RLS del dominio rifa (owner/superadmin + anon público seguro).
- [ ] Tipos en `src/types/index.ts`.
- [ ] `src/lib/rifa.ts` (núcleo puro: métricas + `resolverGanadores`).
- [ ] `src/actions/rifas.ts` (CRUD + reserva + pago + dashboard + auto-match).
- [ ] Backoffice: lista y detalle de rifa con config (tipo, cifras, premios).
- [ ] Grilla de números (marcar/tachar/emoji) + estados.
- [ ] `/r/[slug]` público con Realtime (libres en vivo, reserva sin cuenta).
- [ ] Dashboard financiero (pagó/debe, totales, % cumplimiento, faltan, editar pago).
- [ ] Export xlsx.
- [ ] Sorteo: interna (manual) + lotería (ingresar resultado → auto-match),
      ganador enmascarado + mensaje de felicitación.
- [ ] Regla "boleta no pagada no juega" aplicada en el match.

## Fase 1b · Monetización + Export imagen (día 1, junto al MVP)
- [ ] Migración `cobros.sql` (`plataforma_config` editable, planes en
      tenants/rifas, tabla `cobros`, `puede_crear_gratis` leyendo config).
- [ ] `/superadmin/settings`: form para editar precios y reglas del free
      (superadmin varía costos sin tocar código).
- [ ] `activarRifa` con validación de cuota/plan + tamaño (lee `plataforma_config`;
      si no aplica gratis → cobro pendiente + rifa en borrador).
- [ ] `cobros.ts` (solo superadmin): `confirmarCobro` activa rifa / extiende
      suscripción. Prepago manual vía Nequi.
- [ ] `/precios` público + vista de plan del owner (lee `plataforma_config`).
- [ ] Panel de cobros del superadmin (pendientes / confirmar).
- [ ] Route `app/r/[slug]/flyer/route.tsx` con `next/og` (PNG dinámico: grilla
      con ocupados tachados, premios, precio, datos de pago del tenant).
- [ ] Marca de agua en plan Gratis; sin marca en planes pagos.
- [ ] Botón "Exportar imagen" en backoffice + compartir desde `/r/[slug]`.

## Fase 2 · Pulido de plataforma
- [ ] Consentimiento de datos en la reserva + página de política (`/terminos`).
- [ ] Aviso/notificación "boletas no pagadas no entran en juego" (web-push).
- [ ] `/superadmin`: crear tenant + invitar owner.
- [ ] Onboarding del owner nuevo.
- [ ] Automatizar cobro/renovación con Wompi (self-service).
