# Hair by Sara

A static website with no build step. It loads Supabase JS from a CDN for shared data and owner authentication. Serve it over HTTPS or localhost for Supabase Auth; `file://` mode is only a local preview and browser storage may be isolated by page.

## Included

- Eight starting styles with the agreed AUD prices
- Booking form with date selection and daily time slots from 10:00 am to 7:00 pm
- Owner dashboard for upcoming bookings, customer details, booking status management, style and price edits, grouped photo uploads, and working hours
- Separate owner routes at `/admin/login/` and `/admin/dashboard/`
- Public navigation contains only client actions; owner access is available directly at `/admin/login/`
- Shared Supabase data store used by public bookings and the private owner dashboard
- Supabase Free selected for the shared database; initial schema and setup guidance are in `supabase/`
- Client photo gallery for each hairstyle, with horizontal swipe/scroll, previous/next arrows, and a position indicator
- Per-photo crop position, zoom, and rotation controls with preview, save, and reset
- Booking requests are submitted through a Supabase database function when the database is configured; unavailable slots are rejected by the database
- CSV booking export and full local JSON backup (including customer details, original photos, and crop settings); legacy browser data can be exported with `?local-backup=1`
- Favicon, Privacy Policy, and Terms & Conditions
- Charcoal and pink styling with text-only salon branding

## Current limits

Add the salon's real photos in **Owner dashboard → Styles & photos**. Each image must be 1.2 MB or smaller. Clients can click a style photo to open its gallery. In the owner dashboard, drag a photo within its preview to reframe it, or pinch to zoom on a touchscreen; the sliders remain available for fine adjustments. Choose **Save framing** to keep changes or **Reset** to restore the default crop. Framing settings are stored separately from the original photo.

Supabase is configured in `supabase-config.js` with the project URL and publishable key. Apply the SQL migration in `supabase/migrations/` and authorize an owner Auth account before shared data is available. Until then, the public catalogue can fall back to existing browser data for viewing, but online booking is disabled. Existing `hairBySara.v1` data remains in the browser until an owner deliberately imports a backup into an empty Supabase database. Owner sign-in uses Supabase Auth and owner-only policies. Free Supabase projects can pause and do not include automatic database backups. No online payments are implemented. See `supabase/README.md` for setup and migration steps.

Sign in at `/admin/login/` with the owner account configured in Supabase Authentication. Unauthenticated or non-owner visits to `/admin/dashboard/` return to login. Use an HTTPS or localhost URL for the owner routes; opening nested pages as `file://` documents may isolate browser storage between files.
