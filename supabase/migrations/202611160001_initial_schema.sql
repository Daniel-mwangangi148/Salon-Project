-- Hair by Sara schema for Supabase. Apply after choosing the salon timezone.
create schema if not exists private;

create table if not exists public.owner_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.salon_settings (
  id boolean primary key default true check (id),
  timezone text not null default 'Australia/Sydney'
);
insert into public.salon_settings (id, timezone) values (true, 'Australia/Sydney')
on conflict (id) do nothing;

create table if not exists public.hairstyles (
  id text primary key default gen_random_uuid()::text,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  price_aud numeric(10,2) not null check (price_aud >= 0),
  description text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.hairstyle_images (
  id uuid primary key default gen_random_uuid(),
  hairstyle_id text not null references public.hairstyles(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  display_order integer not null default 0,
  adjustments jsonb not null default '{"x":50,"y":50,"zoom":1,"rotation":0,"panX":0,"panY":0}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.working_hours (
  day_of_week smallint primary key check (day_of_week between 0 and 6),
  is_open boolean not null default true,
  open_time time not null default '10:00',
  close_time time not null default '19:00',
  check (not is_open or close_time > open_time)
);
insert into public.working_hours (day_of_week, is_open, open_time, close_time)
select day, true, '10:00'::time, '19:00'::time from generate_series(0, 6) as day
on conflict (day_of_week) do nothing;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  phone text not null check (char_length(btrim(phone)) between 5 and 30),
  email text,
  created_at timestamptz not null default now()
);
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  hairstyle_id text references public.hairstyles(id) on delete set null,
  hairstyle_name text not null,
  price_aud numeric(10,2) not null check (price_aud >= 0),
  booking_date date not null,
  booking_time time not null,
  status text not null default 'requested'
    check (status in ('requested', 'confirmed', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);
create unique index if not exists bookings_active_slot_unique
  on public.bookings (booking_date, booking_time)
  where status in ('requested', 'confirmed');
create index if not exists bookings_date_status_idx on public.bookings (booking_date, status);
create index if not exists bookings_customer_idx on public.bookings (customer_id, created_at desc);
create index if not exists hairstyle_images_style_order_idx on public.hairstyle_images (hairstyle_id, display_order);

create or replace function private.is_owner()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.owner_profiles as profile
    where profile.user_id = (select auth.uid())
  );
$$;
grant usage on schema private to anon, authenticated;
grant execute on function private.is_owner() to anon, authenticated;

alter table public.owner_profiles enable row level security;
alter table public.salon_settings enable row level security;
alter table public.hairstyles enable row level security;
alter table public.hairstyle_images enable row level security;
alter table public.working_hours enable row level security;
alter table public.customers enable row level security;
alter table public.bookings enable row level security;

revoke all on public.owner_profiles, public.salon_settings, public.hairstyles,
  public.hairstyle_images, public.working_hours, public.customers, public.bookings
  from anon, authenticated;
grant select on public.hairstyles, public.hairstyle_images, public.working_hours to anon, authenticated;
grant select on public.owner_profiles to authenticated;
grant select, insert, update, delete on public.salon_settings, public.hairstyles,
  public.hairstyle_images, public.working_hours, public.customers, public.bookings to authenticated;

create policy "Public reads active hairstyles" on public.hairstyles
  for select to anon, authenticated using (is_active or (select private.is_owner()));
create policy "Owner manages hairstyles" on public.hairstyles for all to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));
create policy "Public reads active hairstyle images" on public.hairstyle_images
  for select to anon, authenticated using (
    (select private.is_owner()) or exists (
      select 1 from public.hairstyles as style
      where style.id = hairstyle_id and style.is_active
    )
  );
create policy "Owner manages hairstyle images" on public.hairstyle_images for all to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));
create policy "Public reads working hours" on public.working_hours for select to anon, authenticated using (true);
create policy "Owner manages working hours" on public.working_hours for all to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));
create policy "Owner manages salon settings" on public.salon_settings for all to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));
create policy "Owner reads owner profile" on public.owner_profiles for select to authenticated
  using (user_id = (select auth.uid()) and (select private.is_owner()));
create policy "Owner manages customers" on public.customers for all to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));
create policy "Owner manages bookings" on public.bookings for all to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));

-- Exposes only available times; it never returns customer or booking details.
create or replace function public.get_available_slots(p_booking_date date)
returns table (slot time)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_open time;
  v_close time;
  v_timezone text;
  v_local_now timestamp without time zone;
  v_slot_count integer;
begin
  if p_booking_date is null then return; end if;
  select hours.open_time, hours.close_time into v_open, v_close
  from public.working_hours as hours
  where hours.day_of_week = extract(dow from p_booking_date)::smallint and hours.is_open;
  if not found then return; end if;
  select settings.timezone into v_timezone from public.salon_settings as settings where settings.id;
  v_local_now := pg_catalog.timezone(coalesce(v_timezone, 'Australia/Sydney'), now());
  if p_booking_date < v_local_now::date then return; end if;
  v_slot_count := floor(extract(epoch from (v_close - v_open)) / 1800)::integer;
  return query
  select (v_open + (series.n * interval '30 minutes'))::time
  from pg_catalog.generate_series(0, v_slot_count - 1) as series(n)
  where (
    p_booking_date > v_local_now::date
    or (v_open + (series.n * interval '30 minutes'))::time > v_local_now::time
  )
  and not exists (
    select 1 from public.bookings as booking
    where booking.booking_date = p_booking_date
      and booking.booking_time = (v_open + (series.n * interval '30 minutes'))::time
      and booking.status in ('requested', 'confirmed')
  );
$$;

-- Atomic request path; the unique active-slot index is the final concurrency guard.
create or replace function public.request_booking(
  p_hairstyle_id text,
  p_client_name text,
  p_phone text,
  p_booking_date date,
  p_booking_time time,
  p_email text default null
)
returns table (booking_id uuid, status text)
language plpgsql security definer set search_path = ''
as $$
declare
  v_style_name text;
  v_price numeric(10,2);
  v_customer_id uuid;
  v_booking_id uuid;
begin
  if char_length(btrim(coalesce(p_client_name, ''))) not between 1 and 100 then
    raise exception using errcode = '22023', message = 'Enter a valid client name.';
  end if;
  if char_length(btrim(coalesce(p_phone, ''))) not between 5 and 30 then
    raise exception using errcode = '22023', message = 'Enter a valid phone number.';
  end if;
  if p_email is not null and char_length(p_email) > 254 then
    raise exception using errcode = '22023', message = 'Email address is too long.';
  end if;
  select style.name, style.price_aud into v_style_name, v_price
  from public.hairstyles as style where style.id = p_hairstyle_id and style.is_active;
  if not found then
    raise exception using errcode = '22023', message = 'That hairstyle is unavailable.';
  end if;
  if not exists (
    select 1 from public.get_available_slots(p_booking_date) as available
    where available.slot = p_booking_time
  ) then
    raise exception using errcode = 'P0001', message = 'That appointment time is unavailable.';
  end if;
  insert into public.customers (name, phone, email)
  values (btrim(p_client_name), btrim(p_phone), nullif(btrim(coalesce(p_email, '')), ''))
  returning id into v_customer_id;
  insert into public.bookings (
    customer_id, hairstyle_id, hairstyle_name, price_aud, booking_date, booking_time, status
  ) values (
    v_customer_id, p_hairstyle_id, v_style_name, v_price, p_booking_date, p_booking_time, 'requested'
  ) returning id into v_booking_id;
  return query select v_booking_id, 'requested'::text;
end;
$$;
revoke all on function public.get_available_slots(date) from public;
revoke all on function public.request_booking(text, text, text, date, time, text) from public;
grant execute on function public.get_available_slots(date) to anon, authenticated;
grant execute on function public.request_booking(text, text, text, date, time, text) to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hairstyle-photos', 'hairstyle-photos', true, 1200000, array['image/jpeg','image/png','image/webp','image/avif','image/gif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
create policy "Public reads hairstyle photos" on storage.objects for select to anon, authenticated
  using (bucket_id = 'hairstyle-photos');
create policy "Owner uploads hairstyle photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'hairstyle-photos' and (select private.is_owner()));
create policy "Owner updates hairstyle photos" on storage.objects for update to authenticated
  using (bucket_id = 'hairstyle-photos' and (select private.is_owner()))
  with check (bucket_id = 'hairstyle-photos' and (select private.is_owner()));
create policy "Owner removes hairstyle photos" on storage.objects for delete to authenticated
  using (bucket_id = 'hairstyle-photos' and (select private.is_owner()));
