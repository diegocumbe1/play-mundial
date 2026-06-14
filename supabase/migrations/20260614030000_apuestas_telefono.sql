-- Guarda el dato de contacto de la persona como teléfono.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'apuestas'
      and column_name = 'email'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'apuestas'
      and column_name = 'telefono'
  ) then
    alter table public.apuestas rename column email to telefono;
  end if;
end $$;
