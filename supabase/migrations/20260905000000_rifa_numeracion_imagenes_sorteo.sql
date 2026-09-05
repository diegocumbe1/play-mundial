-- =============================================================================
-- Rifas — Numeración (0/1), imágenes de la publicación y sorteo propio animado
-- =============================================================================
-- 1) `numero_inicial`: las rifas impresas suelen numerarse 1..30, no 00..29.
--    Solo aplica al sorteo propio: en las de lotería el número DEBE cruzar con
--    las cifras del resultado, y ahí la numeración arranca siempre en 0.
-- 2) `imagen_url` / `imagen_fondo_url`: foto del premio (portada) y fondo de la
--    publicación (página pública, flyer y vista previa del enlace).
-- 3) Sorteo propio: cuántas balotas se sacan, si el premio mayor es la última o
--    la primera, y la secuencia real de extracción (para repetir la animación
--    tipo baloto y dejar constancia de cómo se sorteó).
-- Idempotente / re-ejecutable.
-- =============================================================================

alter table public.rifas
  add column if not exists numero_inicial integer not null default 0,
  add column if not exists imagen_url text,
  add column if not exists imagen_fondo_url text,
  add column if not exists sorteo_bolas integer not null default 1,
  add column if not exists sorteo_orden text not null default 'ultimo_mayor',
  add column if not exists sorteo_secuencia jsonb,
  add column if not exists sorteo_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'rifas_numero_inicial_check'
  ) then
    alter table public.rifas
      add constraint rifas_numero_inicial_check check (numero_inicial in (0, 1));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'rifas_sorteo_bolas_check'
  ) then
    alter table public.rifas
      add constraint rifas_sorteo_bolas_check check (sorteo_bolas between 1 and 10);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'rifas_sorteo_orden_check'
  ) then
    alter table public.rifas
      add constraint rifas_sorteo_orden_check
      check (sorteo_orden in ('ultimo_mayor', 'primero_mayor'));
  end if;
end $$;

-- Bucket público para las imágenes de la publicación (la subida va por service
-- role, igual que el QR de pago).
do $$
begin
  insert into storage.buckets (id, name, public)
  values ('rifa-imagenes', 'rifa-imagenes', true)
  on conflict (id) do nothing;
exception when others then
  raise notice 'No se pudo crear el bucket rifa-imagenes (créalo en el dashboard): %', sqlerrm;
end $$;
