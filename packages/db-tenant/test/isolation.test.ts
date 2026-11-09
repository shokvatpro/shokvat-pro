/**
 * Tenant-isolation tests against a real PostgreSQL (docs/TENANT_SECURITY.md §7, MVP AC-ISO-*).
 * Any failure here must block merging.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startPostgres, inTenant, applyMigrations, type Pg } from '../../db-tools/src/pg.ts';

const DB = 'sp_tenant_test';
const A = 'a0000000-0000-4000-8000-000000000001';
const B = 'b0000000-0000-4000-8000-000000000001';
const A1 = 'a1000000-0000-4000-8000-000000000001'; // branch Al Khobar (tenant A)
const A2 = 'a2000000-0000-4000-8000-000000000001'; // branch Dammam (tenant A)
const B1 = 'b1000000-0000-4000-8000-000000000001';
const cA = 'ac000000-0000-4000-8000-000000000001';
const cB = 'bc000000-0000-4000-8000-000000000001';
const chA = 'ad000000-0000-4000-8000-000000000001';
const chB = 'bd000000-0000-4000-8000-000000000001';
const convA1 = 'ae100000-0000-4000-8000-000000000001';
const convA2 = 'ae200000-0000-4000-8000-000000000001';
const convB = 'be000000-0000-4000-8000-000000000001';
const staffA = 'af000000-0000-4000-8000-000000000001';

let pg: Pg;
const asApp = (tenant: string, sql: string, scope = 'all') => pg.query(inTenant(tenant, sql, scope), { db: DB, user: 'sp_app' });
const errApp = (tenant: string, sql: string, scope = 'all') => pg.error(inTenant(tenant, sql, scope), { db: DB, user: 'sp_app' });
const one = (rows: string[][]) => rows[0]?.[0];

before(() => {
  pg = startPostgres();
  pg.query(`DROP DATABASE IF EXISTS ${DB}; CREATE DATABASE ${DB};`);
  applyMigrations(pg, join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations'), DB);
  // Seed as superuser (bypasses RLS) — synthetic data only.
  pg.query(`
    SET search_path = tenant;
    INSERT INTO tenant_settings (tenant_id, is_synthetic) VALUES ('${A}', true), ('${B}', true);
    INSERT INTO branches (id, tenant_id, name_ar, name_en) VALUES
      ('${A1}', '${A}', 'الخبر', 'Al Khobar'), ('${A2}', '${A}', 'الدمام', 'Dammam'), ('${B1}', '${B}', 'الرياض', 'Riyadh');
    INSERT INTO staff (id, tenant_id, user_id, display_name) VALUES ('${staffA}', '${A}', gen_random_uuid(), 'Noura (demo)');
    INSERT INTO channel_accounts (id, tenant_id, type, display_name, external_account_id, status) VALUES
      ('${chA}', '${A}', 'whatsapp', 'A WhatsApp', 'wa-phone-A', 'connected'),
      ('${chB}', '${B}', 'whatsapp', 'B WhatsApp', 'wa-phone-B', 'connected');
    INSERT INTO contacts (id, tenant_id, display_name) VALUES ('${cA}', '${A}', 'Sara (demo)'), ('${cB}', '${B}', 'Omar (demo)');
    INSERT INTO conversations (id, tenant_id, contact_id, channel_account_id, branch_id) VALUES
      ('${convA1}', '${A}', '${cA}', '${chA}', '${A1}'),
      ('${convA2}', '${A}', '${cA}', '${chA}', '${A2}'),
      ('${convB}',  '${B}', '${cB}', '${chB}', '${B1}');
    INSERT INTO messages (tenant_id, conversation_id, direction, sender_type, body, status) VALUES
      ('${A}', '${convA1}', 'inbound', 'contact', 'synthetic A1', 'received'),
      ('${A}', '${convA2}', 'inbound', 'contact', 'synthetic A2', 'received'),
      ('${B}', '${convB}',  'inbound', 'contact', 'synthetic B',  'received');
    INSERT INTO appointments (tenant_id, contact_id, branch_id, starts_at, ends_at) VALUES
      ('${A}', '${cA}', '${A1}', now() + interval '1 day', now() + interval '1 day 30 min'),
      ('${A}', '${cA}', '${A2}', now() + interval '2 day', now() + interval '2 day 30 min'),
      ('${B}', '${cB}', '${B1}', now() + interval '1 day', now() + interval '1 day 30 min');
    INSERT INTO audit_log (tenant_id, actor_type, action) VALUES ('${A}', 'system', 'seed'), ('${B}', 'system', 'seed');
  `, { db: DB });
});

after(() => pg?.stop());

/* ---------- structural guarantees ---------- */

test('every tenant table has tenant_id, RLS enabled AND forced, and at least one policy', () => {
  const rows = pg.query(`
    SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity,
           EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attname = 'tenant_id' AND a.attnotnull),
           (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid)
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'tenant' AND c.relkind IN ('r', 'p') ORDER BY 1;`, { db: DB });
  assert.ok(rows.length >= 19, `expected ≥19 tables, got ${rows.length}`);
  for (const [name, rls, force, hasTenant, policies] of rows) {
    assert.equal(rls, 't', `${name}: RLS not enabled`);
    assert.equal(force, 't', `${name}: RLS not forced`);
    assert.equal(hasTenant, 't', `${name}: tenant_id missing or nullable`);
    assert.ok(Number(policies) >= 1, `${name}: no policy`);
  }
});

test('application role cannot bypass RLS and owns nothing', () => {
  const [[superuser, bypass]] = pg.query(`SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'sp_app'`, { db: DB }) as [[string, string]];
  assert.equal(superuser, 'f');
  assert.equal(bypass, 'f');
  const owned = one(pg.query(`SELECT count(*) FROM pg_class c JOIN pg_roles r ON r.oid = c.relowner WHERE r.rolname = 'sp_app'`, { db: DB }));
  assert.equal(owned, '0');
});

test('every multi-column FK to a tenant table includes tenant_id (no cross-tenant references)', () => {
  const rows = pg.query(`
    SELECT conrelid::regclass, conname, pg_get_constraintdef(oid)
    FROM pg_constraint WHERE contype = 'f' AND connamespace = 'tenant'::regnamespace;`, { db: DB });
  assert.ok(rows.length > 20);
  for (const [table, name, def] of rows) assert.match(def!, /^FOREIGN KEY \(tenant_id, /, `${table}.${name}: ${def}`);
});

/* ---------- fail closed ---------- */

test('no tenant context → error, never rows', () => {
  const err = pg.error(`SELECT count(*) FROM tenant.contacts;`, { db: DB, user: 'sp_app' });
  assert.match(err ?? '', /tenant context missing/);
});

test('empty tenant context after a previous transaction still fails closed', () => {
  const err = pg.error(`BEGIN; SET LOCAL app.tenant_id = '${A}'; COMMIT; SELECT count(*) FROM tenant.contacts;`, { db: DB, user: 'sp_app' });
  assert.match(err ?? '', /tenant context missing/);
});

/* ---------- read isolation ---------- */

test('tenant A sees only its own rows in every table', () => {
  assert.equal(one(asApp(A, `SELECT count(*) FROM tenant.contacts;`)), '1');
  assert.equal(one(asApp(A, `SELECT count(*) FROM tenant.conversations;`)), '2');
  assert.equal(one(asApp(A, `SELECT count(*) FROM tenant.messages;`)), '2');
  assert.equal(one(asApp(A, `SELECT count(*) FROM tenant.appointments;`)), '2');
  assert.equal(one(asApp(A, `SELECT count(*) FROM tenant.audit_log;`)), '1');
  assert.equal(one(asApp(A, `SELECT count(*) FROM tenant.messages WHERE body = 'synthetic B';`)), '0');
});

test('direct lookup of another tenant\'s row by id returns nothing (looks like 404, not 403)', () => {
  assert.equal(one(asApp(A, `SELECT count(*) FROM tenant.conversations WHERE id = '${convB}';`)), '0');
  assert.equal(one(asApp(A, `SELECT count(*) FROM tenant.contacts WHERE id = '${cB}';`)), '0');
});

/* ---------- write isolation ---------- */

test('UPDATE / DELETE of another tenant\'s rows affects zero rows', () => {
  assert.equal(asApp(A, `UPDATE tenant.contacts SET display_name = 'hacked' WHERE id = '${cB}' RETURNING id;`).length, 0);
  assert.equal(asApp(A, `DELETE FROM tenant.messages WHERE tenant_id = '${B}' RETURNING id;`).length, 0);
  assert.equal(one(pg.query(`SELECT display_name FROM tenant.contacts WHERE id = '${cB}'`, { db: DB })), 'Omar (demo)');
});

test('INSERT with another tenant_id is rejected by the policy', () => {
  const err = errApp(A, `INSERT INTO tenant.contacts (tenant_id, display_name) VALUES ('${B}', 'x');`);
  assert.match(err ?? '', /row-level security/);
});

test('moving a row to another tenant via UPDATE is rejected', () => {
  const err = errApp(A, `UPDATE tenant.contacts SET tenant_id = '${B}' WHERE id = '${cA}';`);
  assert.match(err ?? '', /row-level security/);
});

test('composite foreign keys block referencing another tenant\'s contact', () => {
  const err = errApp(A, `INSERT INTO tenant.conversations (tenant_id, contact_id, channel_account_id, branch_id) VALUES ('${A}', '${cB}', '${chA}', '${A1}');`);
  assert.match(err ?? '', /foreign key/);
});

/* ---------- branch scope ---------- */

test('branch-scoped staff see only their branch conversations, messages and appointments', () => {
  assert.equal(one(asApp(A, `SELECT count(*) FROM tenant.conversations;`, A1)), '1');
  assert.equal(one(asApp(A, `SELECT id FROM tenant.conversations;`, A1)), convA1);
  assert.equal(one(asApp(A, `SELECT count(*) FROM tenant.messages;`, A1)), '1');
  assert.equal(one(asApp(A, `SELECT count(*) FROM tenant.appointments;`, A1)), '1');
});

test('branch-scoped staff cannot create conversations in another branch', () => {
  const err = errApp(A, `INSERT INTO tenant.conversations (tenant_id, contact_id, channel_account_id, branch_id) VALUES ('${A}', '${cA}', '${chA}', '${A2}');`, A1);
  assert.match(err ?? '', /row-level security/);
});

test('empty branch scope sees no branch-scoped rows (fail closed)', () => {
  assert.equal(one(asApp(A, `SELECT count(*) FROM tenant.conversations;`, '')), '0');
});

test('a branch id from another tenant grants nothing', () => {
  assert.equal(one(asApp(A, `SELECT count(*) FROM tenant.conversations;`, B1)), '0');
});

/* ---------- append-only ---------- */

test('audit_log: the app cannot update or delete; even the owner is blocked by trigger', () => {
  assert.match(errApp(A, `UPDATE tenant.audit_log SET action = 'x';`) ?? '', /permission denied/);
  assert.match(errApp(A, `DELETE FROM tenant.audit_log;`) ?? '', /permission denied/);
  assert.match(pg.error(`UPDATE tenant.audit_log SET action = 'x';`, { db: DB }) ?? '', /append-only/);
  assert.equal(asApp(A, `INSERT INTO tenant.audit_log (tenant_id, actor_type, action) VALUES ('${A}', 'staff', 'test') RETURNING id;`).length, 1);
});

/* ---------- consent ---------- */

test('marketing allowed only when the latest marketing consent is granted', () => {
  assert.equal(one(asApp(A, `SELECT app.can_send_marketing('${cA}', 'whatsapp');`)), 'f');
  asApp(A, `INSERT INTO tenant.consents (tenant_id, contact_id, channel, purpose, status, source, text_version, captured_at)
            VALUES ('${A}', '${cA}', 'whatsapp', 'marketing', 'granted', 'form', 'v1', now() - interval '1 hour');`);
  assert.equal(one(asApp(A, `SELECT app.can_send_marketing('${cA}', 'whatsapp');`)), 't');
  asApp(A, `INSERT INTO tenant.consents (tenant_id, contact_id, channel, purpose, status, source, text_version)
            VALUES ('${A}', '${cA}', 'whatsapp', 'marketing', 'withdrawn', 'reply STOP', 'v1');`);
  assert.equal(one(asApp(A, `SELECT app.can_send_marketing('${cA}', 'whatsapp');`)), 'f');
  assert.match(errApp(A, `DELETE FROM tenant.consents;`) ?? '', /permission denied/);
});

test('service consent does not unlock marketing', () => {
  asApp(A, `INSERT INTO tenant.consents (tenant_id, contact_id, channel, purpose, status, source, text_version)
            VALUES ('${A}', '${cA}', 'sms', 'service', 'granted', 'booking', 'v1');`);
  assert.equal(one(asApp(A, `SELECT app.can_send_marketing('${cA}', 'sms');`)), 'f');
});

/* ---------- idempotency & identities ---------- */

test('duplicate webhook events are stored once', () => {
  const ins = `INSERT INTO tenant.provider_events (tenant_id, provider, external_event_id) VALUES ('${A}', 'whatsapp', 'wamid.TEST1') ON CONFLICT DO NOTHING RETURNING id;`;
  assert.equal(asApp(A, ins).length, 1);
  assert.equal(asApp(A, ins).length, 0);
});

test('the same phone can exist in two tenants, but only once per tenant', () => {
  const ins = (t: string, c: string) => `INSERT INTO tenant.contact_identities (tenant_id, contact_id, type, value_normalized, value_hash) VALUES ('${t}', '${c}', 'phone', '+966500000000', 'h-966500000000');`;
  assert.equal(errApp(A, ins(A, cA)), null);
  assert.equal(errApp(B, ins(B, cB)), null);
  assert.match(errApp(A, ins(A, cA)) ?? '', /duplicate key/);
});

/* ---------- webhook routing ---------- */

test('ingress can resolve a provider account to its tenant without tenant context, and nothing more', () => {
  const rows = pg.query(`SELECT * FROM app.resolve_channel_account('whatsapp', 'wa-phone-B');`, { db: DB, user: 'sp_app' });
  assert.deepEqual(rows, [[B, chB]]);
  assert.deepEqual(pg.query(`SELECT * FROM app.resolve_channel_account('whatsapp', 'unknown');`, { db: DB, user: 'sp_app' }), []);
  assert.match(pg.error(`SELECT count(*) FROM tenant.channel_accounts;`, { db: DB, user: 'sp_app' }) ?? '', /tenant context missing/);
  assert.match(pg.error(`SET ROLE sp_router;`, { db: DB, user: 'sp_app' }) ?? '', /permission denied/);
});
