-- Remove only the four retired appointment seed rows. The reserved IDs are
-- paired with their original patient and service so unrelated clinic bookings
-- remain untouched.
DELETE FROM "Appointment"
WHERE ("id", "client", "service") IN (
  ('ap-001', 'Mika Santos', 'Aesthetic Consultation'),
  ('ap-002', 'Celine Ann Hernandez', 'Skin Booster Treatment'),
  ('ap-003', 'Andrea Lee', 'Mace Ultralift'),
  ('ap-004', 'Trisha Uy', 'Mace Resurface')
);
