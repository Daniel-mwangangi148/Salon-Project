# Hair by Sara

A no-dependency, static website prototype. Open `index.html` in a modern browser to view it.

## Included

- Eight starting styles with the agreed AUD prices
- Booking form with date selection and daily time slots from 10:00 am to 7:00 pm
- Owner dashboard for upcoming bookings, customer details, booking status management, style and price edits, grouped photo uploads, and working hours
- Client photo gallery for each hairstyle, with horizontal swipe/scroll, previous/next arrows, and a position indicator
- Per-photo crop position, zoom, and rotation controls with preview, save, and reset
- Booking requests saved locally with requested, confirmed, completed, or cancelled status; cancelled slots become available again
- CSV booking export including booking status, favicon, Privacy Policy, and Terms & Conditions
- Charcoal and pink styling with text-only salon branding

## Current limits

Add the salon's real photos in **Owner dashboard → Styles & photos**. Each image must be 1.2 MB or smaller. Clients can click a style photo to open its gallery. In the owner dashboard, drag a photo within its preview to reframe it, or pinch to zoom on a touchscreen; the sliders remain available for fine adjustments. Choose **Save framing** to keep changes or **Reset** to restore the default crop. Framing settings are stored separately from the original photo.

Bookings, styles, hours, and photos are stored in the current browser only. A booking does not notify or sync with the salon, and the owner dashboard is not protected by a login. Before public deployment, connect a secure backend for shared availability, confirmed booking notifications, protected owner access, and server-side data storage. The website is not deployed and no custom domain was provided.
