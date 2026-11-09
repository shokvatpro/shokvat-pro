-- SYNTHETIC DEMO DATA ONLY. Every name, number and message below is invented.
-- Three demo medical centers, the six default roles (docs/TENANT_SECURITY.md §4.2), and sample inbox activity.
-- Load as a superuser AFTER the migrations (seeding bypasses RLS on purpose). Never load in production.

SET search_path = tenant;

-- ---------- demo tenants ----------
CREATE TEMP TABLE demo_tenants (tenant_id uuid, slug text, name_ar text, name_en text, branch_ar text, branch_en text, city text);
INSERT INTO demo_tenants VALUES
  ('d1000000-0000-4000-8000-000000000001', 'oasis-demo',   'مجمع الواحة الطبي — تجريبي',   'Oasis Medical (demo)',   'الخبر',  'Al Khobar', 'Al Khobar'),
  ('d2000000-0000-4000-8000-000000000001', 'nakheel-demo', 'عيادات النخيل — تجريبي',        'Nakheel Clinics (demo)', 'الدمام', 'Dammam',    'Dammam'),
  ('d3000000-0000-4000-8000-000000000001', 'rayan-demo',   'مركز الريان لطب الأسنان — تجريبي', 'Rayan Dental (demo)',  'الرياض', 'Riyadh',    'Riyadh');

INSERT INTO tenant_settings (tenant_id, is_synthetic, sla_first_response_sec, assignment_strategy)
SELECT tenant_id, true, 300, 'round_robin' FROM demo_tenants;

INSERT INTO branches (tenant_id, name_ar, name_en, city)
SELECT tenant_id, branch_ar, branch_en, city FROM demo_tenants;

-- ---------- default roles & permission matrix ----------
CREATE TEMP TABLE role_matrix (key text, name_ar text, name_en text, perms text[]);
INSERT INTO role_matrix VALUES
  ('receptionist', 'موظف استقبال', 'Receptionist',
     ARRAY['inbox.read_assigned', 'inbox.read_branch', 'inbox.reply', 'contacts.read', 'appointments.manage']),
  ('agent', 'موظف خدمة عملاء', 'Customer service agent',
     ARRAY['inbox.read_assigned', 'inbox.reply', 'contacts.read', 'appointments.manage']),
  ('supervisor', 'مشرف', 'Supervisor',
     ARRAY['inbox.read_assigned', 'inbox.read_all', 'inbox.reply', 'inbox.assign', 'contacts.read', 'contacts.merge', 'appointments.manage', 'reports.operational']),
  ('marketing', 'أخصائي تسويق', 'Marketing specialist',
     ARRAY['reports.marketing_aggregate', 'campaigns.manage']),
  ('branch_manager', 'مدير فرع', 'Branch manager',
     ARRAY['inbox.read_assigned', 'inbox.read_branch', 'inbox.reply', 'inbox.assign', 'contacts.read', 'contacts.merge', 'appointments.manage', 'reports.operational', 'staff.manage_branch']),
  ('center_admin', 'مدير المجمع', 'Medical center administrator',
     ARRAY['inbox.read_assigned', 'inbox.read_all', 'inbox.reply', 'inbox.assign', 'contacts.read', 'contacts.export', 'contacts.merge', 'appointments.manage',
           'reports.operational', 'reports.marketing_aggregate', 'campaigns.manage', 'staff.manage', 'channels.manage', 'settings.manage', 'branding.manage',
           'billing.view', 'audit.view']);

INSERT INTO roles (tenant_id, key, name_ar, name_en, is_system)
SELECT t.tenant_id, r.key, r.name_ar, r.name_en, true FROM demo_tenants t CROSS JOIN role_matrix r;

INSERT INTO role_permissions (tenant_id, role_id, permission_key)
SELECT ro.tenant_id, ro.id, unnest(r.perms) FROM roles ro JOIN role_matrix r ON r.key = ro.key;

-- ---------- staff (user ids are placeholders for Control Plane users) ----------
CREATE TEMP TABLE demo_staff (key text, name text, role_key text);
INSERT INTO demo_staff VALUES ('admin', 'مدير تجريبي', 'center_admin'), ('noura', 'نورة (تجريبي)', 'receptionist'), ('fahad', 'فهد (تجريبي)', 'agent'), ('mona', 'منى (تجريبي)', 'marketing');

INSERT INTO staff (tenant_id, user_id, display_name, default_branch_id)
SELECT t.tenant_id, gen_random_uuid(), s.name, b.id FROM demo_tenants t CROSS JOIN demo_staff s JOIN branches b ON b.tenant_id = t.tenant_id;

INSERT INTO staff_roles (tenant_id, staff_id, role_id)
SELECT st.tenant_id, st.id, ro.id FROM staff st JOIN demo_staff s ON s.name = st.display_name JOIN roles ro ON ro.tenant_id = st.tenant_id AND ro.key = s.role_key;

-- ---------- channels (mock mode: no real provider connection) ----------
INSERT INTO channel_accounts (tenant_id, type, mode, display_name, external_account_id, status)
SELECT t.tenant_id, c.type, 'mock', c.label, t.slug || '-' || c.type, 'connected'
FROM demo_tenants t CROSS JOIN (VALUES ('whatsapp', 'WhatsApp (mock)'), ('instagram', 'Instagram (mock)'), ('voice', 'Phone (mock)'), ('tiktok_leads', 'TikTok leads (mock)')) AS c(type, label);

-- ---------- contacts & conversations ----------
CREATE TEMP TABLE demo_contacts (n int, name text, search text, channel text, status text, awaiting boolean, breached boolean, preview text, stage text);
INSERT INTO demo_contacts VALUES
  (1, 'سارة م.',       'ساره م',      'whatsapp',     'open',             true,  true,  'أرغب بحجز موعد يوم الخميس مساءً إن أمكن', 'appointment_requested'),
  (2, 'عبدالله ر.',    'عبدالله ر',   'instagram',    'open',             true,  false, 'كم تكلفة الاستشارة الأولى؟',             'new_inquiry'),
  (3, 'ليان خ.',       'ليان خ',      'whatsapp',     'resolved',         false, false, 'تمام، أراكم الساعة ٥',                   'appointment_booked'),
  (4, 'محمد ع.',       'محمد ع',      'tiktok_leads', 'new',              true,  false, 'نموذج عميل محتمل من حملة الخريف',        'new_inquiry'),
  (5, 'هند س.',        'هند س',       'whatsapp',     'waiting_customer', false, false, 'شكرًا على الرد السريع',                  'contacted');

INSERT INTO contacts (tenant_id, display_name, search_name, primary_branch_id, pipeline_stage, source_channel)
SELECT t.tenant_id, c.name, c.search, b.id, c.stage, c.channel
FROM demo_tenants t CROSS JOIN demo_contacts c JOIN branches b ON b.tenant_id = t.tenant_id;

INSERT INTO conversations (tenant_id, contact_id, channel_account_id, branch_id, status, awaiting_agent, sla_breached, last_inbound_at, first_response_due_at)
SELECT co.tenant_id, co.id, ca.id, co.primary_branch_id, dc.status, dc.awaiting, dc.breached,
       now() - (dc.n * interval '7 minutes'), now() - (dc.n * interval '7 minutes') + interval '5 minutes'
FROM contacts co
JOIN demo_contacts dc ON dc.name = co.display_name
JOIN channel_accounts ca ON ca.tenant_id = co.tenant_id AND ca.type = dc.channel;

INSERT INTO messages (tenant_id, conversation_id, direction, sender_type, body, status, created_at)
SELECT cv.tenant_id, cv.id, 'inbound', 'contact', dc.preview, 'received', cv.last_inbound_at
FROM conversations cv JOIN contacts co ON co.tenant_id = cv.tenant_id AND co.id = cv.contact_id JOIN demo_contacts dc ON dc.name = co.display_name;

INSERT INTO appointments (tenant_id, contact_id, branch_id, starts_at, ends_at, status, source_channel)
SELECT co.tenant_id, co.id, co.primary_branch_id, date_trunc('day', now()) + interval '1 day 14 hours', date_trunc('day', now()) + interval '1 day 14 hours 30 minutes', 'booked', co.source_channel
FROM contacts co WHERE co.pipeline_stage = 'appointment_booked';

INSERT INTO audit_log (tenant_id, actor_type, action, changes)
SELECT tenant_id, 'system', 'demo.seeded', jsonb_build_object('synthetic', true) FROM demo_tenants;
