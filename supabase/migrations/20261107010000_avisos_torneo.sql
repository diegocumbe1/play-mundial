-- =============================================================================
-- Torneos — notificaciones push para el organizador
-- =============================================================================
-- Cada dispositivo guarda aquí su suscripción y sus preferencias. Es una tabla
-- aparte de `push_subscriptions` (avisos de la polla, sin organizador): un aviso
-- de torneo solo debe llegar a los dispositivos de ese organizador.
-- `avisos_torneo_enviados` evita repetir un aviso en el mismo dispositivo.
-- Solo las usa el servidor (service role): RLS activo y sin políticas.
-- Idempotente / re-ejecutable.
-- =============================================================================

create table if not exists public.suscripciones_avisos_torneo (
  endpoint      text primary key,
  p256dh        text not null,
  auth          text not null,
  tenant_id     uuid not null references public.tenants (id) on delete cascade,
  user_id       uuid not null,
  -- Minutos antes del partido para recordar; 0 = sin recordatorio.
  minutos_antes integer not null default 10 check (minutos_antes in (0, 5, 10, 15, 30, 60)),
  partido_nuevo boolean not null default true,
  en_vivo       boolean not null default true,
  finalizado    boolean not null default true,
  siguiente     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists suscripciones_avisos_torneo_tenant_idx
  on public.suscripciones_avisos_torneo (tenant_id);

create table if not exists public.avisos_torneo_enviados (
  encuentro_id uuid not null references public.encuentros (id) on delete cascade,
  endpoint     text not null references public.suscripciones_avisos_torneo (endpoint) on delete cascade,
  tipo         text not null check (tipo in ('recordatorio', 'en_vivo', 'por_aprobar', 'finalizado', 'siguiente')),
  enviado_at   timestamptz not null default now(),
  primary key (encuentro_id, endpoint, tipo)
);

alter table public.suscripciones_avisos_torneo enable row level security;
alter table public.avisos_torneo_enviados enable row level security;
