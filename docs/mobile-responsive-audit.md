# ZenshoTech mobile responsiveness audit

## Public and authentication routes

- `/`
- `/register`
- `/register?branch=…`
- `/pricing` and onboarding/annual variants
- `/subscription`
- `/subscription/expired`
- `/inquire`
- `/book`
- `/client-register`
- password reset query flow
- `/accept-invitation?token=…`
- `/flipbook/view/:token`
- `/attendance/kiosk`

## Authenticated workspace routes

- `/my-workspace`, `/dashboard`, `/applications`
- `/appointments` and `/appointments/:id`
- `/clients` and `/clients/:id`
- `/leads` and `/leads/:id`
- `/pos`, `/card-view`, `/room-view`
- `/treatments` and `/treatments/:id`
- `/services`, `/packages`, `/online-booking`
- `/staff-schedule`, `/staff`, `/staff/:id`, `/attendance`, `/branches`
- `/inventory`, `/expenses`, `/payroll`, `/reports`
- `/settings`, `/support`
- Marketing overview, campaigns, new/deleted campaigns, templates, audiences, automations, media, reports, and settings
- Flipbooks overview, upload, shared links, analytics, deleted, settings, editor, and preview

## Shared responsive behavior

- Desktop retains the full sidebar.
- Tablet uses a compact navigation rail.
- Phones use fixed Dashboard/Appointments/POS/Clients/More navigation filtered by server permissions.
- The More sheet exposes remaining authorized modules plus Getting Started, restart-tour, optional Support, and sign out.
- Shared form controls, drawers, dialogs, record detail views, tables, POS, Payroll, Marketing, Flipbooks, FaceTrack, and dashboard layouts include phone containment and 44px actions.
- Fixed navigation reserves safe-area space and does not cover form actions.
- The automated audit detects document overflow, off-screen interactive controls, runtime errors, and missing mobile navigation.

## Viewports

The complete route matrix is exercised at 320×568, 360×800, 375×667, 390×844, 412×915, 430×932, 768×1024, 820×1180, 1024×768, 1280×720, 1366×768, 1440×900, and 1920×1080.
