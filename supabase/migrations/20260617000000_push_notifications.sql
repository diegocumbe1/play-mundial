-- =============================================================================
-- Web Push para el admin
-- =============================================================================
-- Suscripciones de notificaciones (un dispositivo del admin = una fila) y un
-- flag para no avisar dos veces de un partido finalizado.
-- =============================================================================

create table if not exists public.push_subscriptions (
  endpoint   text primary key,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

-- Solo el service role (servidor) la usa; sin políticas públicas = sin acceso
-- anónimo. El service role salta RLS.
alter table public.push_subscriptions enable row level security;

-- Para no notificar repetidamente cuando un partido ya finalizó.
alter table public.partidos
  add column if not exists aviso_final_enviado boolean not null default false;
