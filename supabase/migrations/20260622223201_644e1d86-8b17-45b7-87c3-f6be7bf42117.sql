GRANT USAGE ON SCHEMA vault TO service_role;
GRANT SELECT ON vault.secrets TO service_role;
GRANT SELECT ON vault.decrypted_secrets TO service_role;

DO $$
BEGIN
  RAISE NOTICE 'vault_usage: %', has_schema_privilege('service_role', 'vault', 'USAGE');
  RAISE NOTICE 'vault_select: %', has_table_privilege('service_role', 'vault.decrypted_secrets', 'SELECT');
END; $$;