-- Tercer estado de pago: la apuesta nunca se pagó y se cierra sin esperar más.
-- Se mantiene el registro (no se borra) y puede llevar nota en nota_pago.
-- pagado sigue siendo la fuente de verdad del pozo: una apuesta "no pagó"
-- tiene pagado=false, así que no cuenta para el premio.
alter table public.apuestas
  add column if not exists no_pago boolean not null default false;
