-- Solo el admin autenticado puede leer filas completas de apuestas.
-- Los resultados publicos usan Server Actions que devuelven agregados anonimos.

drop policy if exists "apuestas_select_public" on public.apuestas;
drop policy if exists "apuestas_select_admin" on public.apuestas;

create policy "apuestas_select_admin" on public.apuestas for select
  to authenticated using (true);
