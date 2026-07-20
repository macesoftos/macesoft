-- Service catalogs are tenant-owned. Remove the original demo catalog while
-- preserving services that users created themselves.
DELETE FROM "Service"
WHERE "id" IN (
  'svc-consult',
  'svc-signature-facial',
  'svc-classic-facial',
  'svc-bb-glow',
  'svc-acne-facial',
  'svc-botox',
  'svc-filler',
  'svc-skin-booster',
  'svc-rejuran',
  'svc-mace-resurface',
  'svc-ultralift',
  'svc-diode',
  'svc-glow-drip',
  'svc-nad',
  'svc-package-glow'
);
