alter table public.apuestas
  add column if not exists cliente_id text;

create index if not exists apuestas_cliente_id_idx
  on public.apuestas (cliente_id);
