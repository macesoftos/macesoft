# ZenshoTech form redesign audit

This checklist records the forms and form-like editors reviewed for the shared compact form system. Business rules, field names, permissions, validation requirements, API calls, and persistence behavior were intentionally left unchanged.

## Shared system

- [x] Global text, email, phone, number, password, search, date, time, and datetime inputs
- [x] Selects, searchable/select-style controls, and multi-select fields
- [x] Textareas and helper/error text
- [x] Checkboxes, radio controls, and switches
- [x] File and image upload controls
- [x] Default, hover, focus, filled, disabled, read-only, error, and success styling hooks
- [x] Two-column desktop and one-column mobile form grids
- [x] Modal close controls, sticky headers/actions, and independently scrolling bodies
- [x] Dynamic consumable rows and reusable chip/multi-select controls

## Public, authentication, and onboarding

- [x] Staff login, password visibility, password reset, and demo signup
- [x] Subscription registration and trial activation
- [x] Public inquiry/contact form
- [x] Public appointment booking form
- [x] Invitation acceptance and connected staff login

## Scheduling and clinical records

- [x] New/edit appointment drawer, recurrence, availability, payment, and notes
- [x] Appointment schedule filters and searchable fields
- [x] New/edit treatment record, grouped into Record Details, Treatment Timing, Consumables, Device Information, Consent and Follow-up, and Clinical Notes
- [x] Digital consent completion and signature form
- [x] Room creation and room/archive confirmation dialogs
- [x] Treatment photo/file upload controls

## CRM, clients, and staff

- [x] New/edit client and clinical profile fields
- [x] New/edit lead, lead quick actions, stage changes, and lead detail forms
- [x] New/edit employee, schedule entry, and day-off swap forms
- [x] User invitation, access management, and account security forms
- [x] Branch creation/editing, hours, modules, manager selection, and clinic image upload

## Commerce and operations

- [x] POS quick service, cart quantity, discount, payment, installment, reference, and context forms
- [x] Service and package setup
- [x] Gift certificate creation/checking
- [x] Inventory item, stock receiving, and inventory import/upload controls
- [x] Expense, promotion, campaign, and system settings forms
- [x] Report filters and toolbar/search fields

## Dedicated workspaces

- [x] Payroll employee/pay-rule setup, run creation, adjustments, weekday choices, and switches
- [x] FaceTrack registration, device, attendance, and kiosk forms
- [x] Marketing campaign, audience, SMS, settings, builder, style, media, personalization, and HTML editor controls
- [x] Flipbook upload, metadata, sharing, lock, logo, color, and editor settings forms

## Responsive and interaction checks

- [x] Mobile: one-column fields, full-height form modal, reachable sticky actions
- [x] Tablet: responsive grids and modal width constrained to viewport
- [x] Laptop: long treatment form scrolls only in its body
- [x] Desktop: compact two-column layouts and 44px standard controls
- [x] Long labels/values remain inside min-width-constrained grid cells
- [x] Dropdown and picker controls are not placed inside newly clipped field wrappers
- [x] Keyboard focus remains visible and labels remain associated with controls
- [x] Cancel/close and loading/disabled states retain their existing behavior

## Shared tokens and components changed

- `--form-control-height`, `--form-control-radius`, control border/background/focus/error/success tokens
- `--form-field-gap` and `--form-section-gap`
- Shared `.form-grid`, `.stacked-field`, checkbox, file, textarea, select, and helper/error styles
- Shared `EntityModal` header/body/footer anatomy and section renderer
- Shared appointment drawer, legacy modal footer, and responsive modal rules
- Module adapters for Payroll, FaceTrack, Marketing, and Flipbooks

## Verification

- Frontend production compile (`vite build`)
- ESLint and TypeScript checks
- Server unit/integration test suite
- Playwright form-system checks for compact control dimensions, sectioning, sticky/reachable actions, scrolling, and mobile reflow

