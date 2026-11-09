-- Reference data. Prices are the Saudi TEST prices (docs/INTERNATIONALIZATION.md §5, decision Q-05: yearly = 10 months).
-- Other countries stay 'closed' until COUNTRY_LAUNCH_CHECKLIST is signed. Tax rates are NOT stored here (accountant to define).
SET search_path = control;

INSERT INTO currencies (code, minor_units, symbol_ar, symbol_en) VALUES
  ('SAR', 2, 'ر.س', 'SAR'), ('EGP', 2, 'ج.م', 'EGP'), ('AED', 2, 'د.إ', 'AED'), ('QAR', 2, 'ر.ق', 'QAR'),
  ('KWD', 3, 'د.ك', 'KWD'), ('BHD', 3, 'د.ب', 'BHD'), ('OMR', 3, 'ر.ع', 'OMR');

INSERT INTO data_regions (code, location_label, status) VALUES
  ('sa-1', 'Saudi Arabia — provider pending legal review (Q-01)', 'planned'),
  ('eg-1', 'Egypt — pending legal review', 'planned'),
  ('ae-1', 'United Arab Emirates — pending legal review', 'planned');

-- Saudi Arabia is 'planned' until Q-01/Q-02 are resolved; synthetic (demo) tenants are still allowed for development.
INSERT INTO countries (code, name_ar, name_en, timezone, currency, calling_code, launch_status, data_region) VALUES
  ('SA', 'السعودية', 'Saudi Arabia', 'Asia/Riyadh', 'SAR', '+966', 'planned', 'sa-1'),
  ('EG', 'مصر', 'Egypt', 'Africa/Cairo', 'EGP', '+20', 'legal_review', 'eg-1'),
  ('AE', 'الإمارات', 'United Arab Emirates', 'Asia/Dubai', 'AED', '+971', 'planned', 'ae-1'),
  ('KW', 'الكويت', 'Kuwait', 'Asia/Kuwait', 'KWD', '+965', 'closed', NULL),
  ('QA', 'قطر', 'Qatar', 'Asia/Qatar', 'QAR', '+974', 'closed', NULL),
  ('BH', 'البحرين', 'Bahrain', 'Asia/Bahrain', 'BHD', '+973', 'closed', NULL),
  ('OM', 'عُمان', 'Oman', 'Asia/Muscat', 'OMR', '+968', 'closed', NULL);

INSERT INTO plans (code, tier, name_ar, name_en, trial_days) VALUES
  ('basic', 'basic', 'الأساسية', 'Basic', 14),
  ('pro', 'pro', 'الاحترافية', 'Professional', 14),
  ('enterprise', 'enterprise', 'المؤسسات', 'Enterprise', 14);

INSERT INTO plan_limits (plan_id, key, value)
SELECT p.id, l.key, l.value FROM plans p
JOIN (VALUES
  ('basic', 'users', 3), ('basic', 'branches', 1), ('basic', 'channels', 2),
  ('pro', 'users', 10), ('pro', 'branches', 3), ('pro', 'channels', 6),
  ('enterprise', 'users', 25), ('enterprise', 'branches', 10), ('enterprise', 'channels', 20)
) AS l(code, key, value) ON l.code = p.code;

INSERT INTO plan_features (plan_id, feature_key)
SELECT p.id, f.feature FROM plans p
JOIN (VALUES
  ('basic', 'inbox'), ('basic', 'crm'), ('basic', 'appointments'), ('basic', 'reports.basic'),
  ('pro', 'inbox'), ('pro', 'crm'), ('pro', 'appointments'), ('pro', 'reports.basic'), ('pro', 'sla'), ('pro', 'auto_assign'), ('pro', 'tenant_branding'), ('pro', 'funnel'),
  ('enterprise', 'inbox'), ('enterprise', 'crm'), ('enterprise', 'appointments'), ('enterprise', 'reports.basic'), ('enterprise', 'sla'), ('enterprise', 'auto_assign'),
  ('enterprise', 'tenant_branding'), ('enterprise', 'funnel'), ('enterprise', 'sso'), ('enterprise', 'audit_export'), ('enterprise', 'tenant_subdomain')
) AS f(code, feature) ON f.code = p.code;

INSERT INTO plan_prices (plan_id, country_code, currency, billing_interval, amount_minor, valid_from)
SELECT p.id, 'SA', 'SAR', i.billing_interval, i.amount_minor, '2026-11-01T00:00:00Z' FROM plans p
JOIN (VALUES
  ('basic', 'month', 69900), ('basic', 'year', 699000),
  ('pro', 'month', 129900), ('pro', 'year', 1299000),
  ('enterprise', 'month', 249900), ('enterprise', 'year', 2499000)
) AS i(code, billing_interval, amount_minor) ON i.code = p.code;

INSERT INTO feature_flags (key, scope, scope_id, enabled) VALUES
  ('channel.tiktok_dm', 'global', '*', false),        -- blocked until official availability is confirmed
  ('voice.recording', 'global', '*', false),
  ('ai.conversation_features', 'global', '*', false);
