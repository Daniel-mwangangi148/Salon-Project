# Hair by Sara

A no-dependency, static website prototype. Open `index.html` in a modern browser to view it.

## Included

- Eight starting styles with the agreed AUD prices
- Booking form with date selection and daily time slots from 10:00 am to 7:00 pm
- Owner dashboard for upcoming bookings, customer details, booking status management, style and price edits, grouped photo uploads, and working hours
- Separate owner routes at `/admin/login/` and `/admin/dashboard/`
- Public navigation contains only client actions; owner access is available directly at `/admin/login/`
- Shared data-store boundary used by the public booking flow and owner dashboard, ready for a database-backed adapter
- Client photo gallery for each hairstyle, with horizontal swipe/scroll, previous/next arrows, and a position indicator
- Per-photo crop position, zoom, and rotation controls with preview, save, and reset
- Booking requests saved locally with requested, confirmed, completed, or cancelled status; cancelled slots become available again
- CSV booking export including booking status, favicon, Privacy Policy, and Terms & Conditions
- Charcoal and pink styling with text-only salon branding

## Current limits

Add the salon's real photos in **Owner dashboard → Styles & photos**. Each image must be 1.2 MB or smaller. Clients can click a style photo to open its gallery. In the owner dashboard, drag a photo within its preview to reframe it, or pinch to zoom on a touchscreen; the sliders remain available for fine adjustments. Choose **Save framing** to keep changes or **Reset** to restore the default crop. Framing settings are stored separately from the original photo.

Bookings, styles, hours, and photos are stored in the current browser only through `data-store.js`, which retains the existing `hairBySara.v1` local-storage key and data shape. Both public and owner screens use the same adapter boundary, ready for a shared database implementation. A booking does not notify or sync with the salon. The owner login stores a passcode verifier in the browser as a development gate; it is not secure authentication for a public website. Before public deployment, connect a secure backend for shared availability, confirmed booking notifications, protected owner access, and server-side data storage. No online payments are implemented. The website is not deployed and no custom domain was provided.

The first visit to `/admin/login/` sets up a local passcode. Unauthenticated visits to `/admin/dashboard/` redirect to login. The logout button and dashboard close button end the current owner session. Use an HTTPS or localhost URL for the owner routes; opening nested pages as `file://` documents may isolate browser storage between files.
