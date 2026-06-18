alter table public.apuestas
  add column if not exists premio_pagado boolean not null default false;
