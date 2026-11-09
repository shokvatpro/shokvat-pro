# تصميم قاعدة البيانات — شوكفات برو
**DATABASE_DESIGN.md** · الإصدار 0.1 (مسودة للاعتماد)

---

## 1. المبادئ
1. **قاعدتان منطقيتان منفصلتان:** `control` (عالمية) و `tenant_<region>` (لكل منطقة). لا مفاتيح أجنبية بينهما؛ الربط بالمعرّف فقط.
2. **كل جدول بيانات مجمع يحمل `tenant_id`** (NOT NULL) ويخضع لسياسة RLS.
3. **المعرّفات:** UUID v7 (مرتبة زمنيًا) — لا أرقام تسلسلية مكشوفة.
4. **الأوقات:** `timestamptz` بتوقيت UTC دائمًا؛ التحويل للتوقيت المحلي في العرض حسب الفرع.
5. **المال:** `amount_minor bigint` + `currency char(3)` — لا `float`. (الدينار الكويتي/البحريني/العماني 3 خانات عشرية: `minor_units` من جدول العملات.)
6. **الحذف:** Soft delete (`deleted_at`) للكيانات التشغيلية + مهمة حذف نهائي حسب سياسة الاحتفاظ لكل دولة.
7. **التشفير على مستوى الحقل** للحقول عالية الحساسية: رموز القنوات، أسرار MFA، (اختياريًا) أرقام الهواتف مع فهرس Hash للبحث.
8. **سجل التدقيق** append-only (لا UPDATE/DELETE عبر صلاحيات قاعدة البيانات).

---

## 2. نموذج تعدد المستأجرين

| الخيار | الوصف | القرار |
|---|---|---|
| Shared DB + `tenant_id` + **RLS** | جداول مشتركة، عزل في المحرك | **افتراضي لكل الباقات في MVP** |
| Schema-per-tenant | مخطط لكل مجمع | مرفوض (تعقيد migrations) |
| Database-per-tenant | قاعدة مستقلة | **خيار مستقبلي لباقة المؤسسات** أو متطلب قانوني لدولة |

**آلية RLS:**
```sql
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON conversations
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
```
- التطبيق يتصل بدور `app_user` **ليس مالكًا للجداول** ولا يملك `BYPASSRLS`.
- كل طلب يفتح معاملة ويضبط `SET LOCAL app.tenant_id` (و `app.user_id` و `app.branch_ids` عند الحاجة).
- إذا لم يُضبط `app.tenant_id` ← `current_setting` يرمي خطأ ← لا يُرجع أي صف (Fail closed).
- دور `migrator` منفصل للـ migrations فقط، ودور `maintenance` بصلاحيات محدودة ومسجّلة للمهام الإدارية.

---

## 3. قاعدة Control Plane (`control`)

```
countries(code PK 'SA', name_ar, name_en, default_locale, timezone, currency, phone_prefix,
          launch_status[closed|planned|legal_review|pilot|live], data_region, tax_profile_id,
          payment_provider, retention_policy_id, created_at)
currencies(code PK, minor_units, symbol_ar, symbol_en)
data_regions(code PK 'sa-1', api_base_url, provider, location_label, status)

tenants(id PK, slug UNIQUE, display_name, legal_name, country_code FK, region FK,
        status[trial|active|past_due|suspended|cancelled], created_at, suspended_at, cancelled_at)
tenant_branding(tenant_id PK FK, logo_light_key, logo_dark_key, accent_color, display_name_ar,
                display_name_en, subdomain, email_sender_name, updated_by, updated_at)

users(id PK, email UNIQUE citext, name, locale, password_hash, status, created_at, last_login_at)
user_mfa(user_id FK, type[totp|webauthn], secret_enc, created_at, last_used_at)
sessions(id PK, user_id FK, device_label, ip_hash, user_agent, created_at, expires_at, revoked_at)
memberships(user_id FK, tenant_id FK, status[invited|active|disabled], PK(user_id, tenant_id))
platform_roles(user_id FK, role[platform_owner|platform_billing|platform_support|compliance_officer])

plans(id PK, code, name_ar, name_en, tier[basic|pro|enterprise], is_active)
plan_prices(id PK, plan_id FK, country_code FK, currency, interval[month|year], amount_minor,
            tax_inclusive bool, valid_from, valid_to)
plan_limits(plan_id FK, key[users|branches|channels|monthly_conversations|...], value)
features(key PK, description) ; plan_features(plan_id, feature_key)
feature_flags(key, scope[global|country|plan|tenant], scope_id, enabled, rollout_pct)

subscriptions(id PK, tenant_id FK, plan_price_id FK, status[trialing|active|past_due|cancelled|paused],
              trial_ends_at, current_period_start, current_period_end, cancel_at_period_end,
              provider, provider_subscription_id, created_at)
subscription_addons(subscription_id, addon_code, quantity)
invoices(id PK, tenant_id, subscription_id, number UNIQUE per country, currency, subtotal_minor,
         tax_minor, total_minor, status[draft|open|paid|void|uncollectible], issued_at, due_at,
         tax_fields jsonb, pdf_key)
invoice_lines(id, invoice_id, description, quantity, unit_minor, tax_rate, amount_minor)
payments(id, invoice_id, provider, provider_payment_id UNIQUE, amount_minor, currency,
         status, failure_code, created_at)
payment_events(id, provider, external_event_id, payload_hash, processed_at, UNIQUE(provider, external_event_id))
usage_snapshots(tenant_id, period, metric, value, reported_at)   -- أرقام مجمعة فقط

support_tickets(id, tenant_id, opened_by, subject, status, priority, created_at)
support_access_grants(id, tenant_id, requested_by, approved_by_tenant_user, scope, reason,
                      starts_at, expires_at, revoked_at)
platform_audit_log(id, actor_user_id, action, target_type, target_id, metadata jsonb, ip_hash, created_at)
```

> **ملاحظة خصوصية:** `users` في Control Plane تحتوي بيانات **موظفي** المجمعات (لتسجيل الدخول) وليس المرضى. هل يُقبل تخزين بيانات الموظفين عالميًا؟ **قرار قانوني (Q-11)**؛ البديل: هوية موظفين إقليمية.

---

## 4. قاعدة Data Plane (`tenant_<region>`)

### 4.1 التنظيم
```
tenant_settings(tenant_id PK, timezone, default_locale, sla_first_response_sec, working_hours jsonb,
                assignment_strategy[manual|round_robin|load_balanced], entitlements jsonb, updated_at)
branches(id, tenant_id, name_ar, name_en, city, timezone, phone, is_active)
departments(id, tenant_id, branch_id NULL, name_ar, name_en, is_active)
staff(id, tenant_id, user_id (من control), display_name, status, default_branch_id)
roles(id, tenant_id NULL(=نظامي), key, name_ar, name_en, is_system)
role_permissions(role_id, permission_key)
staff_roles(staff_id, role_id, branch_id NULL)   -- الدور قد يكون مقيدًا بفرع
teams(id, tenant_id, name) ; team_members(team_id, staff_id)
```

### 4.2 القنوات
```
channel_accounts(id, tenant_id, type[whatsapp|messenger|instagram|meta_leads|tiktok_leads|tiktok_dm|voice|webchat],
                 display_name, external_account_id, branch_id NULL, status[pending|connected|error|disconnected],
                 credentials_enc bytea, credentials_key_id, token_expires_at, connected_by, created_at)
provider_events(id, tenant_id, provider, external_event_id, received_at, status, error,
                UNIQUE(provider, external_event_id))      -- idempotency
message_templates(id, tenant_id, channel_account_id, name, language, category[utility|marketing|authentication],
                  body, variables jsonb, provider_status[draft|pending|approved|rejected], provider_template_id)
```

### 4.3 العملاء وصندوق الوارد
```
contacts(id, tenant_id, display_name, preferred_locale, primary_branch_id, owner_staff_id,
         pipeline_stage, lifecycle_status[active|archived|merged], merged_into_id,
         source_channel, source_campaign_id, first_seen_at, last_activity_at, created_at, deleted_at)
contact_identities(id, tenant_id, contact_id, type[phone|whatsapp|instagram|messenger|tiktok|email],
                   value_normalized, value_hash, is_verified, UNIQUE(tenant_id, type, value_hash))
contact_interests(contact_id, tenant_id, service_category_id)   -- فئات خدمة عامة فقط
service_categories(id, tenant_id, name_ar, name_en, is_sensitive bool)  -- is_sensitive يمنع استخدامها تسويقيًا
tags(id, tenant_id, name, color) ; contact_tags(contact_id, tag_id)
duplicate_candidates(id, tenant_id, contact_a, contact_b, reason, status[open|merged|dismissed], reviewed_by)

conversations(id, tenant_id, contact_id, channel_account_id, branch_id, status[new|open|pending|waiting_customer|resolved|closed],
              assigned_staff_id, assigned_team_id, last_inbound_at, last_outbound_at,
              awaiting_agent bool, first_response_due_at, first_responded_at, sla_breached bool,
              whatsapp_window_expires_at, priority, opened_at, resolved_at, closed_at)
messages(id, tenant_id, conversation_id, direction[inbound|outbound], sender_type[contact|staff|system|bot],
         sender_staff_id, type[text|image|audio|video|document|location|template|interactive|call_event],
         body_enc / body, provider_message_id, status[queued|sent|delivered|read|failed],
         error_code, template_id, created_at, provider_ts)
attachments(id, tenant_id, message_id, storage_key, mime, size_bytes, sha256, scanned_status)
internal_notes(id, tenant_id, conversation_id, author_staff_id, body, mentions uuid[], created_at)
saved_replies(id, tenant_id, scope[tenant|team|personal], owner_id, shortcut, body_ar, body_en)
assignments_log(id, tenant_id, conversation_id, from_staff, to_staff, reason, actor, created_at)

calls(id, tenant_id, contact_id, channel_account_id, direction, status[ringing|answered|missed|voicemail|failed],
      from_e164_hash, to_e164, started_at, answered_at, ended_at, duration_sec, handled_by_staff_id,
      recording_key NULL, callback_task_id NULL)
```

### 4.4 المواعيد والمهام
```
appointments(id, tenant_id, contact_id, branch_id, department_id, provider_name NULL,
             starts_at, ends_at, status[requested|booked|confirmed|attended|no_show|cancelled|rescheduled],
             cancel_reason, source_conversation_id, source_channel, source_campaign_id,
             booked_by_staff_id, external_ref NULL, created_at, updated_at)
appointment_events(id, tenant_id, appointment_id, from_status, to_status, actor, at)
tasks(id, tenant_id, contact_id NULL, conversation_id NULL, type[follow_up|callback|reminder],
      title, due_at, assigned_staff_id, status[open|done|cancelled], created_by)
```

### 4.5 التسويق والموافقات
```
campaigns(id, tenant_id, name, platform[meta|tiktok|google|other], external_campaign_id, utm_campaign, started_at, ended_at)
lead_submissions(id, tenant_id, provider, form_id, campaign_id, contact_id, raw_fields_enc, received_at)
consents(id, tenant_id, contact_id, channel, purpose[service|marketing], status[granted|withdrawn],
         source, text_version, captured_by, captured_at, withdrawn_at)    -- append-only
suppression_list(tenant_id, identity_hash, channel, reason, created_at)
```

### 4.6 التحليلات والتدقيق
```
daily_metrics(tenant_id, date, branch_id, channel, staff_id NULL, metric, value)   -- مجمّعة
audit_log(id, tenant_id, actor_type[staff|system|platform_support], actor_id, action, entity_type, entity_id,
          changes jsonb (دون محتوى رسائل), ip_hash, created_at)   -- append-only + partitioned by month
```

---

## 5. الفهارس الأساسية
- `conversations (tenant_id, status, awaiting_agent, last_inbound_at DESC)` — قائمة الوارد.
- `conversations (tenant_id, assigned_staff_id, status)` — «محادثاتي».
- `conversations (tenant_id, sla_breached) WHERE status IN ('new','open')`.
- `messages (tenant_id, conversation_id, created_at)`.
- `contact_identities (tenant_id, type, value_hash)` UNIQUE.
- `appointments (tenant_id, branch_id, starts_at)`.
- تقسيم (Partitioning) شهري لـ `messages` و `audit_log` عند تجاوز الحجم المتوقع.

---

## 6. الاحتفاظ والحذف
- `retention_policies` تُعرَّف لكل دولة (في Control) وتُنسخ للـ Data Plane.
- مهمة يومية تحذف/تُخفي هوية المحادثات المغلقة بعد المدة المحددة.
- تصدير بيانات المجمع عند الإلغاء (JSON + CSV + المرفقات) ثم حذف بعد مهلة متفق عليها.
- طلبات أصحاب البيانات (الوصول/التصحيح/الحذف) عبر سير عمل موثّق مع سجل تدقيق.
- النسخ الاحتياطية تنتهي صلاحيتها وفق نفس السياسة (يُوثَّق أثر الحذف على النسخ).

---

## 7. البيانات الوهمية (Seed)
- مولّد في `packages/testing` يُنتج 3 مجمعات تجريبية (أسماء خيالية بوضوح، مثل «مجمع الواحة — تجريبي»)، أرقام هواتف من نطاقات غير مخصصة، ورسائل مولّدة.
- كل سجل وهمي يحمل `is_synthetic = true` على مستوى المجمع، وتُظهر الواجهة شارة «بيانات تجريبية».

---

## 8. الـ ERD المختصر

```
control:  countries ─< tenants ─1 tenant_branding
                       tenants ─< memberships >─ users ─< user_mfa / sessions
                       tenants ─< subscriptions >─ plan_prices >─ plans ─< plan_limits / plan_features
                       subscriptions ─< invoices ─< payments

tenant:   branches ─< departments
          staff >─< roles (staff_roles)
          channel_accounts ─< conversations >─ contacts ─< contact_identities
          conversations ─< messages ─< attachments
          conversations ─< internal_notes / assignments_log
          contacts ─< appointments ─< appointment_events
          contacts ─< consents ; contacts ─< tasks ; campaigns ─< lead_submissions
```
