-- Webhook ingress must find which tenant owns a provider account BEFORE any tenant context exists.
-- Instead of giving the app a way around RLS, we expose ONE narrow SECURITY DEFINER function that
-- returns only (tenant_id, channel_account_id) for an exact (type, external_account_id) match.
-- It is owned by sp_router (BYPASSRLS, NOLOGIN) — nobody can log in as it, and it can do nothing else.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sp_router') THEN
    CREATE ROLE sp_router NOLOGIN BYPASSRLS;
  END IF;
END $$;

GRANT USAGE ON SCHEMA tenant, app TO sp_router;
GRANT SELECT (tenant_id, id, type, external_account_id, status) ON tenant.channel_accounts TO sp_router;

CREATE OR REPLACE FUNCTION app.resolve_channel_account(p_type text, p_external_account_id text)
RETURNS TABLE (tenant_id uuid, channel_account_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, tenant
AS $$
  SELECT ca.tenant_id, ca.id
  FROM tenant.channel_accounts ca
  WHERE ca.type = p_type
    AND ca.external_account_id = p_external_account_id
    AND ca.status <> 'disconnected'
$$;

ALTER FUNCTION app.resolve_channel_account(text, text) OWNER TO sp_router;
REVOKE ALL ON FUNCTION app.resolve_channel_account(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.resolve_channel_account(text, text) TO sp_app;
