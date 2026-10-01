ALTER TABLE "Appointment"
  ADD COLUMN "bookingSource" TEXT NOT NULL DEFAULT 'Staff entry',
  ADD COLUMN "contactMobile" TEXT NOT NULL DEFAULT '';
