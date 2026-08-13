-- Remove only the four retired lead seed rows. Each ID is paired with the
-- original name, mobile number, and campaign so unrelated clinic leads remain
-- untouched even if they happen to use a similar name.
DELETE FROM "Lead"
WHERE ("id", "name", "mobile", "campaign") IN (
  ('lead-001', 'Janine Cruz', '0917 771 2011', 'July Skin Boosters'),
  ('lead-002', 'Patricia Lim', '0916 220 3412', 'Botox Reel Inquiry'),
  ('lead-003', 'Elaine Tan', '0927 881 3000', 'Resurface Lead Ad'),
  ('lead-004', 'Rachelle Go', '0918 001 8821', 'Ultralift Landing Page')
);
