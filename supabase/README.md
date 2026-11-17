# Supabase setup

Supabase Free is the selected backend. The project URL and publishable key are configured in `../supabase-config.js`. Shared data is not active until the SQL migration is applied and the owner account is authorized. Existing browser data remains untouched until it is explicitly imported.

## Migration

For a new Supabase project, apply `migrations/202611160001_initial_schema.sql` first through the Supabase SQL Editor. It creates:

- Styles and grouped hairstyle image records, including saved framing settings
- Customer and booking tables with AUD price snapshots
- Seven-day working hours and the `Australia/Sydney` timezone used in Canberra
- Owner-only table policies, public style/availability reads, and a public booking request function
- A unique database index to reject two active requests for the same date and time
- A public hairstyle photo bucket with owner-only upload/update/delete access

The public booking function exposes only its booking reference and status. Public availability returns only time values; customers and bookings remain owner-only.

## Follow-up migrations

For an existing project that already has the initial schema, apply these files in timestamp order in the Supabase SQL Editor:

1. `migrations/202611170001_one_active_booking_per_customer_per_day.sql` blocks a phone number from holding more than one requested or confirmed booking on a date. Cancelled and completed bookings do not block a new request. This migration leaves existing bookings untouched.
2. `migrations/202611170002_realtime_salon_updates.sql` adds the salon tables to Supabase Realtime so connected client pages and owner dashboards receive live changes without reloading.

The website code for these features is ready, but they are not active on the hosted database until the corresponding SQL files have been run.

## Owner account

1. Create/invite the owner user in Supabase Authentication. Turn off public sign-up once the owner account has been created.
2. Copy the owner user's UUID from the Auth users list.
3. In the SQL Editor, add that UUID to the owner allowlist:

   ```sql
   insert into public.owner_profiles (user_id)
   values ('OWNER_AUTH_USER_UUID');
   ```

4. The app must use Supabase Auth for sign-in before the protected dashboard can access owner data.

## Browser settings

The static browser app uses Supabase JS from the official CDN, the project URL, and the publishable key. The remote adapter supports catalogue/working-hour reads, public availability and booking requests, owner-authenticated dashboard reads/updates, and Storage uploads. The publishable key is intended for browser use only with RLS active. Never put a Supabase secret/service-role key in website files or Git.

## Protect existing salon data

Do not clear `hairBySara.v1` from browser storage. Before moving to a different site origin, open the existing site with `?local-backup=1` and use the existing local owner passcode to download its data. This same-page backup route keeps access to the old browser storage and does not modify it. The owner dashboard also offers **Appointments → Export full backup**. Both files include styles, bookings, hours, original uploaded photo data, and crop settings. Keep the download private and retain the browser copy until the remote records have been checked. The owner dashboard can import a backup only when the shared database is empty; this avoids accidental overwrites or duplicate records.

Free projects can pause after a week of low activity, and Free does not include automatic database backups. Export database backups regularly during development and early use.
