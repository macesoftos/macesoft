-- Keep persisted subscriptions aligned with the canonical plan allowances.
UPDATE "Subscription"
SET "includedWebsitePages" = CASE "planCode"
  WHEN 'growth' THEN 15
  WHEN 'unlimited' THEN 20
  ELSE 8
END;
