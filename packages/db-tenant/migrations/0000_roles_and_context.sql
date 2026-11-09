-- Regional Data Plane — roles and tenant context.
-- Run once per database by a superuser (infrastructure/bootstrap), BEFORE the schema migrations.
--
--   sp_migrator     owns all objects; used only by the migration job. Never used by the application.
--   sp_app          the application/worker login. NOT owner, NO BYPASSRLS → row-level security always applies.
--   sp_maintenance  restricted operational tasks (retention jobs); every use is audited by the operator.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sp_migrator') THEN
    CREATE ROLE sp_migrator NOLOGIN NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sp_app') THEN
    CREATE ROLE sp_app LOGIN NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sp_maintenance') THEN
    CREATE ROLE sp_maintenance NOLOGIN NOBYPASSRLS;
  END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS app AUTHORIZATION sp_migrator;
CREATE SCHEMA IF NOT EXISTS tenant AUTHORIZATION sp_migrator;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA app, tenant TO sp_app, sp_maintenance;
