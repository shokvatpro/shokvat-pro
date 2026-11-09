-- Global Control Plane schema (docs/DATABASE_DESIGN.md §3) — subscription and platform data ONLY.
-- No patient data, no message content, no customer records ever live here.

CREATE SCHEMA IF NOT EXISTS control;
SET search_path = control;

CREATE TABLE currencies (
  code char(3) PRIMARY KEY,
  minor_units smallint NOT NULL CHECK (minor_units BETWEEN 0 AND 3),
  symbol_ar text NOT NULL,
  symbol_en text NOT NULL
);

CREATE TABLE data_regions (
  code text PRIMARY KEY CHECK (code ~ '^[a-z]{2,4}-[0-9]+$'),
  api_base_url text,
  provider text,                          -- decided per Q-01 after legal review
  location_label text NOT NULL,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'provisioning', 'active', 'retired'))
);

CREATE TABLE countries (
  code char(2) PRIMARY KEY,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  default_locale text NOT NULL DEFAULT 'ar' CHECK (default_locale IN ('ar', 'en')),
  timezone text NOT NULL,
  currency char(3) NOT NULL REFERENCES currencies (code),
  calling_code text NOT NULL,
  launch_status text NOT NULL DEFAULT 'closed' CHECK (launch_status IN ('closed', 'planned', 'legal_review', 'pilot', 'live')),
  data_region text REFERENCES data_regions (code),
  payment_adapter text,
  launch_checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- A country cannot accept tenants until it has a data region.
  CHECK (launch_status NOT IN ('pilot', 'live') OR data_region IS NOT NULL)
);

CREATE TABLE tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$'),
  display_name text NOT NULL,
  legal_name text,
  country_code char(2) NOT NULL REFERENCES countries (code),
  region text NOT NULL REFERENCES data_regions (code),
  status text NOT NULL DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'past_due', 'suspended', 'cancelled')),
  is_synthetic boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  suspended_at timestamptz,
  cancelled_at timestamptz
);

-- Tenants may only be created in countries that are open (pilot/live) and in that country's region.
CREATE OR REPLACE FUNCTION control.enforce_tenant_country() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c control.countries;
BEGIN
  SELECT * INTO c FROM control.countries WHERE code = NEW.country_code;
  IF c.launch_status NOT IN ('pilot', 'live') AND NOT NEW.is_synthetic THEN
    RAISE EXCEPTION 'country % is not open for tenants (status %)', NEW.country_code, c.launch_status;
  END IF;
  IF NEW.region IS DISTINCT FROM c.data_region THEN
    RAISE EXCEPTION 'tenant region % does not match country region %', NEW.region, c.data_region;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tenants_country_gate BEFORE INSERT OR UPDATE OF country_code, region ON tenants
  FOR EACH ROW EXECUTE FUNCTION control.enforce_tenant_country();

CREATE TABLE tenant_branding (
  tenant_id uuid PRIMARY KEY REFERENCES tenants (id) ON DELETE CASCADE,
  display_name_ar text NOT NULL,
  display_name_en text NOT NULL,
  accent_color text CHECK (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  accent_color_resolved text CHECK (accent_color_resolved ~ '^#[0-9A-Fa-f]{6}$'),
  accent_color_dark_resolved text CHECK (accent_color_dark_resolved ~ '^#[0-9A-Fa-f]{6}$'),
  logo_light_key text,
  logo_dark_key text,
  subdomain text UNIQUE CHECK (subdomain ~ '^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$'),
  email_sender_name text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  name text NOT NULL,
  locale text NOT NULL DEFAULT 'ar' CHECK (locale IN ('ar', 'en')),
  numerals text NOT NULL DEFAULT 'latn' CHECK (numerals IN ('latn', 'arab')),
  password_hash text,                     -- argon2id; NULL for SSO-only users
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('invited', 'active', 'locked', 'disabled')),
  failed_logins integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);
CREATE UNIQUE INDEX users_email_unique ON users (lower(email));

CREATE TABLE user_mfa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('totp', 'webauthn')),
  secret_enc bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,        -- only the hash of the session token is stored
  device_label text,
  ip_hash text,
  mfa_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);
CREATE INDEX sessions_user_idx ON sessions (user_id) WHERE revoked_at IS NULL;

CREATE TABLE memberships (
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tenant_id)
);

CREATE TABLE platform_roles (
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('platform_owner', 'platform_billing', 'platform_support', 'compliance_officer')),
  PRIMARY KEY (user_id, role)
);

CREATE TABLE plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  tier text NOT NULL CHECK (tier IN ('basic', 'pro', 'enterprise')),
  name_ar text NOT NULL,
  name_en text NOT NULL,
  trial_days integer NOT NULL DEFAULT 14 CHECK (trial_days BETWEEN 0 AND 90),
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE plan_limits (
  plan_id uuid NOT NULL REFERENCES plans (id) ON DELETE CASCADE,
  key text NOT NULL CHECK (key IN ('users', 'branches', 'channels', 'monthly_conversations')),
  value integer NOT NULL CHECK (value >= 0),
  PRIMARY KEY (plan_id, key)
);

CREATE TABLE plan_features (
  plan_id uuid NOT NULL REFERENCES plans (id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  PRIMARY KEY (plan_id, feature_key)
);

CREATE TABLE plan_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES plans (id),
  country_code char(2) NOT NULL REFERENCES countries (code),
  currency char(3) NOT NULL REFERENCES currencies (code),
  billing_interval text NOT NULL CHECK (billing_interval IN ('month', 'year')),
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  tax_inclusive boolean NOT NULL DEFAULT false,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_to timestamptz,
  UNIQUE (plan_id, country_code, billing_interval, valid_from)
);

CREATE TABLE feature_flags (
  key text NOT NULL,
  scope text NOT NULL CHECK (scope IN ('global', 'country', 'plan', 'tenant')),
  scope_id text NOT NULL DEFAULT '*',
  enabled boolean NOT NULL,
  PRIMARY KEY (key, scope, scope_id)
);

CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  plan_price_id uuid NOT NULL REFERENCES plan_prices (id),
  status text NOT NULL CHECK (status IN ('trialing', 'active', 'past_due', 'paused', 'cancelled')),
  trial_ends_at timestamptz,
  current_period_start timestamptz NOT NULL,
  current_period_end timestamptz NOT NULL,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  provider text,
  provider_subscription_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (current_period_end > current_period_start)
);
-- At most one non-cancelled subscription per tenant.
CREATE UNIQUE INDEX subscriptions_one_open ON subscriptions (tenant_id) WHERE status <> 'cancelled';

CREATE TABLE invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  subscription_id uuid REFERENCES subscriptions (id),
  country_code char(2) NOT NULL REFERENCES countries (code),
  number text NOT NULL,
  currency char(3) NOT NULL REFERENCES currencies (code),
  subtotal_minor bigint NOT NULL CHECK (subtotal_minor >= 0),
  tax_minor bigint NOT NULL CHECK (tax_minor >= 0),
  total_minor bigint NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible')),
  tax_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  issued_at timestamptz,
  due_at timestamptz,
  UNIQUE (country_code, number),
  CHECK (total_minor = subtotal_minor + tax_minor)
);

CREATE TABLE payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  external_event_id text NOT NULL,
  payload_hash text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE (provider, external_event_id)    -- duplicate webhooks can never double-charge or double-renew
);

CREATE TABLE usage_snapshots (
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  period date NOT NULL,
  metric text NOT NULL,
  value bigint NOT NULL,                  -- aggregated counts only
  reported_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, period, metric)
);

CREATE TABLE support_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  requested_by uuid NOT NULL REFERENCES users (id),
  approved_by uuid REFERENCES users (id),
  scope text NOT NULL,
  reason text NOT NULL CHECK (length(reason) >= 10),
  starts_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at IS NULL OR expires_at <= starts_at + interval '24 hours')
);

CREATE TABLE platform_audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id uuid,
  action text NOT NULL,
  target_type text,
  target_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION control.reject_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION '% is append-only', TG_TABLE_NAME; END $$;
CREATE TRIGGER platform_audit_append_only BEFORE UPDATE OR DELETE ON platform_audit_log
  FOR EACH ROW EXECUTE FUNCTION control.reject_mutation();
