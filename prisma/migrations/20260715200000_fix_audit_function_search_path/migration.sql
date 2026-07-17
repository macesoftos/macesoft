-- The trigger function does not resolve application objects by name, so an
-- empty search path removes mutable-schema lookup from its execution context.
ALTER FUNCTION "public"."prevent_audit_log_mutation"()
SET search_path = '';
