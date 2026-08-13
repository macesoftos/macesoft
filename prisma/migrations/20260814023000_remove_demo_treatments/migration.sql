-- Remove only the three original demo treatment records. Pair each fixed seed
-- ID with its original client, service, and date so clinic-created records are
-- preserved even if they contain similar treatment details.
DELETE FROM "Treatment"
WHERE ("id", "client", "service", "date") IN (
  ('tr-001', 'Celine Ann Hernandez', 'Skin Booster Treatment', '2026-07-01'),
  ('tr-002', 'Trisha Uy', 'Mace Resurface', '2026-06-19'),
  ('tr-003', 'Andrea Lee', 'Mace Ultralift', '2026-06-21')
);
