alter table public.apuestas
  add column if not exists metodo_pago text;

alter table public.apuestas
  drop constraint if exists apuestas_metodo_pago_check;

alter table public.apuestas
  add constraint apuestas_metodo_pago_check
  check (metodo_pago is null or metodo_pago in ('efectivo', 'transferencia'));
