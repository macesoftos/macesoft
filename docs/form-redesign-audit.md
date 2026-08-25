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
- [x] Title-case labels with shared weight/color tokens (legacy uppercase overrides removed)
- [x] Compact public registration fields within the 42-48px system range

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
- [x] Discount details, applicability, approval, expiry, and status
- [x] Promotion details, included services/packages, schedule, branches, and status
- [x] Gift-certificate details, value, validity, redemption branch, and status
- [x] Package details, client/session settings, purchase, billing, and installment forms
- [x] Expense details, payment, approval, receipt, and notes
- [x] Stock receiving, supplier verification, check number, and receiving notes

## Dedicated workspaces

- [x] Payroll employee/pay-rule setup, run creation, adjustments, weekday choices, and switches
- [x] FaceTrack registration, device, attendance, and kiosk forms
- [x] Marketing campaign, audience, SMS, settings, builder, style, media, personalization, and HTML editor controls
- [x] Flipbook upload, metadata, sharing, lock, logo, color, and editor settings forms
- [x] Dedicated Marketing action-dialog scrolling header/body/footer anatomy
- [x] Flipbook modal sticky header/footer behavior
- [x] FaceTrack correction-dialog sticky header/action behavior

## Configuration and administration

- [x] Consent-template identity, related services, content, required fields, and activation
- [x] Campaign identity, audience/channel, message/template, delivery metrics, and status
- [x] Business identity, currency, tax, receipts, invoice, SMS, backup, and plan-visibility settings
- [x] Invitation identity, role, branch, module, permission, confirmation, and message fields
- [x] User-access status, role, branch, module, and permission forms
- [x] Branch identity, cover upload, location, contact, operating hours, capacity, managers, modules, and status
- [x] Account password, first-time password, reset-password, and login-connection forms

## Responsive and interaction checks

- [x] Mobile: one-column fields, full-height form modal, reachable sticky actions
- [x] Tablet: responsive grids and modal width constrained to viewport
- [x] Laptop: long treatment form scrolls only in its body
- [x] Desktop: compact two-column layouts and 44px standard controls
- [x] Explicit viewport checks at 390x844, 768x1024, 1280x720, 1366x768, 1440x900, and 1920x1080
- [x] Long labels/values remain inside min-width-constrained grid cells
- [x] Dropdown and picker controls are not placed inside newly clipped field wrappers
- [x] Keyboard focus remains visible and labels remain associated with controls
- [x] Cancel/close and loading/disabled states retain their existing behavior
- [x] Registration controls remain compact on desktop and collapse to one column on mobile
- [x] Expense and package create forms expose logical section headings
- [x] Consumable rows can be added and removed without changing treatment submission behavior
- [x] Client image upload and removal controls remain reachable and correctly associated

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
- Playwright form-system checks for dynamic consumables, client image uploads, and six responsive viewport sizes

