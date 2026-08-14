-- Remove the single retired Card View demo booking that survived after its
-- seeded client was deleted. Match the complete identity so no real booking
-- or unrelated walk-in appointment can be removed by this cleanup.

DELETE FROM "Appointment"
WHERE "id" = 'ap-mro2kp6q-3tjnt'
  AND "clientId" IS NULL
  AND "client" = 'Andrea Lee'
  AND "service" = 'Aesthetic Consultation'
  AND "date" = '2026-07-20'
  AND "time" = '08:45';
