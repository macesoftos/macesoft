-- Bind public booking retries and appointment deposit redemptions to stable,
-- single-use identifiers without affecting existing records.
ALTER TABLE "Appointment" ADD COLUMN "publicBookingKey" TEXT;
ALTER TABLE "Sale" ADD COLUMN "appointmentId" TEXT;

CREATE UNIQUE INDEX "Appointment_publicBookingKey_key" ON "Appointment"("publicBookingKey");
CREATE UNIQUE INDEX "Sale_appointmentId_key" ON "Sale"("appointmentId");
