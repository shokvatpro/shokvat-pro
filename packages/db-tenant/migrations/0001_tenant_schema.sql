-- Regional Data Plane — core tenant schema (MVP subset of docs/DATABASE_DESIGN.md §4).
-- Executed as sp_migrator.
--
-- Isolation rules implemented here (see docs/TENANT_SECURITY.md):
--   1. Every table has tenant_id NOT NULL.
--   2. RLS is ENABLED and FORCED on every table; policies read the transaction-local setting app.tenant_id.
--   3. Missing context fails closed: app.tenant_id() raises an error instead of returning rows.
--   4. Foreign keys are COMPOSITE (tenant_id, id): FK checks bypass RLS in PostgreSQL, so a single-column
--      FK would let tenant A reference tenant B's rows. Composite keys make that impossible.
--   5. Branch-scoped staff only see conversations/appointments in their branches (app.branch_scope).
--   6. audit_log and consents are append-only.

SET ROLE sp_migrator;
SET search_path = tenant, app;

-- ---------- context helpers ----------
CREATE OR REPLACE FUNCTION app.tenant_id() RETURNS uuid
LANGUAGE plpgsql STABLE AS $$
DECLARE v text := current_setting('app.tenant_id', true);
BEGIN
  IF v IS NULL OR v = '' THEN
    RAISE EXCEPTION 'tenant context missing (app.tenant_id not set)' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN v::uuid;
END $$;

-- 'all' or a comma-separated list of branch uuids. Unset → no branch-scoped rows (fail closed).
CREATE OR REPLACE FUNCTION app.branch_allowed(b uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN coalesce(current_setting('app.branch_scope', true), '') = 'all' THEN true
    WHEN coalesce(current_setting('app.branch_scope', true), '') = '' THEN false
    ELSE b IS NOT NULL AND b = ANY (string_to_array(current_setting('app.branch_scope', true), ',')::uuid[])
  END
$$;

CREATE OR REPLACE FUNCTION app.reject_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = 'insufficient_privilege';
END $$;

-- ---------- organisation ----------
CREATE TABLE tenant_settings (
  tenant_id uuid PRIMARY KEY,
  timezone text NOT NULL DEFAULT 'Asia/Riyadh',
  default_locale text NOT NULL DEFAULT 'ar' CHECK (default_locale IN ('ar', 'en')),
  sla_first_response_sec integer NOT NULL DEFAULT 300 CHECK (sla_first_response_sec BETWEEN 30 AND 86400),
  working_hours jsonb NOT NULL DEFAULT '{}'::jsonb,
  assignment_strategy text NOT NULL DEFAULT 'manual' CHECK (assignment_strategy IN ('manual', 'round_robin', 'load_balanced')),
  entitlements jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_synthetic boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE branches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  city text,
  timezone text NOT NULL DEFAULT 'Asia/Riyadh',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE departments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  branch_id uuid,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, branch_id) REFERENCES branches (tenant_id, id)
);

CREATE TABLE staff (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,                 -- identity lives in the Control Plane
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('invited', 'active', 'disabled')),
  default_branch_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, user_id),
  FOREIGN KEY (tenant_id, default_branch_id) REFERENCES branches (tenant_id, id)
);

CREATE TABLE roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  key text NOT NULL,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  is_system boolean NOT NULL DEFAULT false,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, key)
);

CREATE TABLE role_permissions (
  tenant_id uuid NOT NULL,
  role_id uuid NOT NULL,
  permission_key text NOT NULL CHECK (permission_key ~ '^[a-z_]+(\.[a-z_]+)+$'),
  PRIMARY KEY (tenant_id, role_id, permission_key),
  FOREIGN KEY (tenant_id, role_id) REFERENCES roles (tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE staff_roles (
  tenant_id uuid NOT NULL,
  staff_id uuid NOT NULL,
  role_id uuid NOT NULL,
  branch_id uuid,                        -- NULL = whole tenant
  PRIMARY KEY (tenant_id, staff_id, role_id),
  FOREIGN KEY (tenant_id, staff_id) REFERENCES staff (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, role_id) REFERENCES roles (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, branch_id) REFERENCES branches (tenant_id, id)
);

-- ---------- channels & ingestion ----------
CREATE TABLE channel_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('whatsapp', 'messenger', 'instagram', 'meta_leads', 'tiktok_leads', 'tiktok_dm', 'voice', 'webchat')),
  mode text NOT NULL DEFAULT 'mock' CHECK (mode IN ('mock', 'sandbox', 'live', 'blocked')),
  display_name text NOT NULL,
  external_account_id text NOT NULL,
  branch_id uuid,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'connected', 'error', 'disconnected')),
  credentials_enc bytea,
  credentials_key_id text,
  token_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (type, external_account_id),    -- one provider account belongs to exactly one tenant
  FOREIGN KEY (tenant_id, branch_id) REFERENCES branches (tenant_id, id)
);

CREATE TABLE provider_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  provider text NOT NULL,
  external_event_id text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processed', 'failed', 'dead')),
  error text,
  PRIMARY KEY (id),
  UNIQUE (provider, external_event_id)   -- webhook idempotency
);

-- ---------- CRM ----------
CREATE TABLE contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  display_name text NOT NULL,
  search_name text NOT NULL DEFAULT '',  -- normalised by @shokfat/i18n normalizeArabic()
  preferred_locale text CHECK (preferred_locale IN ('ar', 'en')),
  primary_branch_id uuid,
  owner_staff_id uuid,
  pipeline_stage text NOT NULL DEFAULT 'new_inquiry' CHECK (pipeline_stage IN (
    'new_inquiry', 'contacted', 'qualified', 'appointment_requested', 'appointment_booked',
    'appointment_confirmed', 'attended', 'cancelled', 'no_show', 'closed')),
  lifecycle_status text NOT NULL DEFAULT 'active' CHECK (lifecycle_status IN ('active', 'archived', 'merged')),
  merged_into_id uuid,
  source_channel text,
  source_campaign_id text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, primary_branch_id) REFERENCES branches (tenant_id, id),
  FOREIGN KEY (tenant_id, owner_staff_id) REFERENCES staff (tenant_id, id),
  FOREIGN KEY (tenant_id, merged_into_id) REFERENCES contacts (tenant_id, id)
);

CREATE TABLE contact_identities (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  contact_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('phone', 'whatsapp', 'instagram', 'messenger', 'tiktok', 'email')),
  value_normalized text NOT NULL,        -- E.164 for phones
  value_hash text NOT NULL,              -- HMAC for lookups without scanning plaintext
  is_verified boolean NOT NULL DEFAULT false,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, type, value_hash),  -- same phone may exist in another tenant, never twice in one
  FOREIGN KEY (tenant_id, contact_id) REFERENCES contacts (tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  contact_id uuid NOT NULL,
  channel_account_id uuid NOT NULL,
  branch_id uuid,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'open', 'pending', 'waiting_customer', 'resolved', 'closed')),
  assigned_staff_id uuid,
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  awaiting_agent boolean NOT NULL DEFAULT false,
  first_response_due_at timestamptz,
  first_responded_at timestamptz,
  sla_breached boolean NOT NULL DEFAULT false,
  whatsapp_window_expires_at timestamptz,
  opened_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  closed_at timestamptz,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, contact_id) REFERENCES contacts (tenant_id, id),
  FOREIGN KEY (tenant_id, channel_account_id) REFERENCES channel_accounts (tenant_id, id),
  FOREIGN KEY (tenant_id, branch_id) REFERENCES branches (tenant_id, id),
  FOREIGN KEY (tenant_id, assigned_staff_id) REFERENCES staff (tenant_id, id)
);
CREATE INDEX conversations_inbox_idx ON conversations (tenant_id, status, awaiting_agent, last_inbound_at DESC);
CREATE INDEX conversations_mine_idx ON conversations (tenant_id, assigned_staff_id, status);
CREATE INDEX conversations_sla_idx ON conversations (tenant_id, sla_breached) WHERE status IN ('new', 'open');

CREATE TABLE messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  conversation_id uuid NOT NULL,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  sender_type text NOT NULL CHECK (sender_type IN ('contact', 'staff', 'system', 'bot')),
  sender_staff_id uuid,
  type text NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'image', 'audio', 'video', 'document', 'location', 'template', 'interactive', 'call_event')),
  body text,                              -- encrypted at rest by the storage layer; field-level encryption decision pending
  provider_message_id text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'delivered', 'read', 'failed', 'received')),
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, conversation_id) REFERENCES conversations (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, sender_staff_id) REFERENCES staff (tenant_id, id)
);
CREATE INDEX messages_conversation_idx ON messages (tenant_id, conversation_id, created_at);

CREATE TABLE internal_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  conversation_id uuid NOT NULL,
  author_staff_id uuid NOT NULL,
  body text NOT NULL,
  mentions uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (tenant_id, conversation_id) REFERENCES conversations (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, author_staff_id) REFERENCES staff (tenant_id, id)
);

CREATE TABLE saved_replies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  scope text NOT NULL DEFAULT 'tenant' CHECK (scope IN ('tenant', 'personal')),
  owner_staff_id uuid,
  shortcut text NOT NULL,
  body_ar text,
  body_en text,
  PRIMARY KEY (id),
  FOREIGN KEY (tenant_id, owner_staff_id) REFERENCES staff (tenant_id, id)
);

-- ---------- appointments & tasks ----------
CREATE TABLE appointments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  contact_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  department_id uuid,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'booked' CHECK (status IN ('requested', 'booked', 'confirmed', 'attended', 'no_show', 'cancelled', 'rescheduled')),
  cancel_reason text,
  source_conversation_id uuid,
  source_channel text,
  source_campaign_id text,
  booked_by_staff_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  CHECK (ends_at > starts_at),
  FOREIGN KEY (tenant_id, contact_id) REFERENCES contacts (tenant_id, id),
  FOREIGN KEY (tenant_id, branch_id) REFERENCES branches (tenant_id, id),
  FOREIGN KEY (tenant_id, department_id) REFERENCES departments (tenant_id, id),
  FOREIGN KEY (tenant_id, source_conversation_id) REFERENCES conversations (tenant_id, id),
  FOREIGN KEY (tenant_id, booked_by_staff_id) REFERENCES staff (tenant_id, id)
);
CREATE INDEX appointments_day_idx ON appointments (tenant_id, branch_id, starts_at);

CREATE TABLE appointment_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  appointment_id uuid NOT NULL,
  from_status text,
  to_status text NOT NULL,
  actor_staff_id uuid,
  at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (tenant_id, appointment_id) REFERENCES appointments (tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  contact_id uuid,
  conversation_id uuid,
  type text NOT NULL CHECK (type IN ('follow_up', 'callback', 'reminder')),
  title text NOT NULL,
  due_at timestamptz NOT NULL,
  assigned_staff_id uuid,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (tenant_id, contact_id) REFERENCES contacts (tenant_id, id),
  FOREIGN KEY (tenant_id, conversation_id) REFERENCES conversations (tenant_id, id),
  FOREIGN KEY (tenant_id, assigned_staff_id) REFERENCES staff (tenant_id, id)
);

-- ---------- consent (append-only: withdrawal is a new row) ----------
CREATE TABLE consents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  contact_id uuid NOT NULL,
  channel text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('service', 'marketing')),
  status text NOT NULL CHECK (status IN ('granted', 'withdrawn')),
  source text NOT NULL,
  text_version text NOT NULL,
  captured_by_staff_id uuid,
  captured_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (tenant_id, contact_id) REFERENCES contacts (tenant_id, id)
);
CREATE INDEX consents_latest_idx ON consents (tenant_id, contact_id, channel, purpose, captured_at DESC);

-- Latest consent wins. Marketing messages are allowed only when the latest marketing consent is 'granted'.
CREATE OR REPLACE FUNCTION app.can_send_marketing(p_contact uuid, p_channel text) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT coalesce((
    SELECT status = 'granted' FROM tenant.consents
    WHERE tenant_id = app.tenant_id() AND contact_id = p_contact AND channel = p_channel AND purpose = 'marketing'
    ORDER BY captured_at DESC, id DESC LIMIT 1
  ), false)
$$;

-- ---------- audit (append-only, never contains message bodies) ----------
CREATE TABLE audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY,
  tenant_id uuid NOT NULL,
  actor_type text NOT NULL CHECK (actor_type IN ('staff', 'system', 'platform_support')),
  actor_id uuid,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);
CREATE INDEX audit_log_tenant_idx ON audit_log (tenant_id, created_at DESC);

CREATE TRIGGER audit_log_append_only BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION app.reject_mutation();
CREATE TRIGGER consents_append_only BEFORE UPDATE OR DELETE ON consents
  FOR EACH ROW EXECUTE FUNCTION app.reject_mutation();

-- ---------- row-level security ----------
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'tenant' LOOP
    EXECUTE format('ALTER TABLE tenant.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE tenant.%I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- Tenant-wide tables
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tenant_settings', 'branches', 'departments', 'staff', 'roles', 'role_permissions', 'staff_roles',
                           'channel_accounts', 'provider_events', 'contacts', 'contact_identities', 'saved_replies',
                           'appointment_events', 'tasks', 'consents', 'audit_log'] LOOP
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON tenant.%I USING (tenant_id = app.tenant_id()) WITH CHECK (tenant_id = app.tenant_id())', t);
  END LOOP;
END $$;

-- Branch-scoped tables
CREATE POLICY tenant_branch_isolation ON conversations
  USING (tenant_id = app.tenant_id() AND app.branch_allowed(branch_id))
  WITH CHECK (tenant_id = app.tenant_id() AND app.branch_allowed(branch_id));
CREATE POLICY tenant_branch_isolation ON appointments
  USING (tenant_id = app.tenant_id() AND app.branch_allowed(branch_id))
  WITH CHECK (tenant_id = app.tenant_id() AND app.branch_allowed(branch_id));

-- Children of conversations inherit their visibility (the sub-select is itself subject to RLS).
CREATE POLICY tenant_branch_isolation ON messages
  USING (tenant_id = app.tenant_id() AND EXISTS (SELECT 1 FROM tenant.conversations c WHERE c.tenant_id = messages.tenant_id AND c.id = messages.conversation_id))
  WITH CHECK (tenant_id = app.tenant_id() AND EXISTS (SELECT 1 FROM tenant.conversations c WHERE c.tenant_id = messages.tenant_id AND c.id = messages.conversation_id));
CREATE POLICY tenant_branch_isolation ON internal_notes
  USING (tenant_id = app.tenant_id() AND EXISTS (SELECT 1 FROM tenant.conversations c WHERE c.tenant_id = internal_notes.tenant_id AND c.id = internal_notes.conversation_id))
  WITH CHECK (tenant_id = app.tenant_id() AND EXISTS (SELECT 1 FROM tenant.conversations c WHERE c.tenant_id = internal_notes.tenant_id AND c.id = internal_notes.conversation_id));

-- ---------- privileges ----------
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA tenant TO sp_app;
REVOKE UPDATE, DELETE ON tenant.audit_log, tenant.consents FROM sp_app;
REVOKE DELETE ON tenant.provider_events FROM sp_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA tenant TO sp_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO sp_app;

RESET ROLE;
