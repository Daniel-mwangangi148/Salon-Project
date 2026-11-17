-- Allow connected website tabs to receive salon catalogue, hours, and
-- owner-visible booking changes through Supabase Realtime.
do $$
declare
  table_name text;
begin
  if not exists (
    select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime'
  ) then
    raise exception 'Supabase Realtime publication is unavailable for this project.';
  end if;

  foreach table_name in array array['hairstyles', 'hairstyle_images', 'working_hours', 'bookings'] loop
    if not exists (
      select 1
      from pg_catalog.pg_publication_tables as publication_table
      where publication_table.pubname = 'supabase_realtime'
        and publication_table.schemaname = 'public'
        and publication_table.tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end;
$$;
