-- Prevent the same phone number from holding multiple active appointments
-- on one salon date. Existing bookings are retained as-is.
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
  v_phone_key text;
begin
  if char_length(btrim(coalesce(p_client_name, ''))) not between 1 and 100 then
    raise exception using errcode = '22023', message = 'Enter a valid client name.';
  end if;

  v_phone_key := regexp_replace(btrim(coalesce(p_phone, '')), '[^0-9]', '', 'g');
  if char_length(v_phone_key) = 11 and left(v_phone_key, 2) = '61' then
    v_phone_key := '0' || substring(v_phone_key from 3);
  end if;
  if char_length(v_phone_key) not between 5 and 30 then
    raise exception using errcode = '22023', message = 'Enter a valid phone number.';
  end if;
  if p_email is not null and char_length(p_email) > 254 then
    raise exception using errcode = '22023', message = 'Email address is too long.';
  end if;

  select style.name, style.price_aud into v_style_name, v_price
  from public.hairstyles as style
  where style.id = p_hairstyle_id and style.is_active;
  if not found then
    raise exception using errcode = '22023', message = 'That hairstyle is unavailable.';
  end if;

  -- Serialize attempts for this customer and date so simultaneous requests
  -- cannot both pass the active-booking check.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_phone_key || ':' || p_booking_date::text, 0)
  );

  if exists (
    select 1
    from public.bookings as booking
    join public.customers as customer on customer.id = booking.customer_id
    where booking.booking_date = p_booking_date
      and booking.status in ('requested', 'confirmed')
      and case
        when char_length(regexp_replace(customer.phone, '[^0-9]', '', 'g')) = 11
          and left(regexp_replace(customer.phone, '[^0-9]', '', 'g'), 2) = '61'
        then '0' || substring(regexp_replace(customer.phone, '[^0-9]', '', 'g') from 3)
        else regexp_replace(customer.phone, '[^0-9]', '', 'g')
      end = v_phone_key
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'You already have an active booking on this date. Please choose another date or contact the salon.';
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

revoke all on function public.request_booking(text, text, text, date, time, text) from public;
grant execute on function public.request_booking(text, text, text, date, time, text) to anon, authenticated;
