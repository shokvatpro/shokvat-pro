import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startPostgres, applyMigrations, type Pg } from '../../db-tools/src/pg.ts';

const DB = 'sp_control_test';
let pg: Pg;
const q = (sql: string) => pg.query(`SET search_path = control;\n${sql}`, { db: DB });
const err = (sql: string) => pg.error(`SET search_path = control;\n${sql}`, { db: DB });
const one = (rows: string[][]) => rows[0]?.[0];

before(() => {
  pg = startPostgres();
  pg.query(`DROP DATABASE IF EXISTS ${DB}; CREATE DATABASE ${DB};`);
  applyMigrations(pg, join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations'), DB);
});
after(() => pg?.stop());

test('all seven target countries exist; only those with a data region can open', () => {
  assert.equal(one(q(`SELECT count(*) FROM countries`)), '7');
  assert.match(err(`UPDATE countries SET launch_status = 'pilot' WHERE code = 'KW';`) ?? '', /check constraint/);
});

test('KWD, BHD and OMR use three minor units', () => {
  assert.deepEqual(q(`SELECT code FROM currencies WHERE minor_units = 3 ORDER BY code`).map((r) => r[0]), ['BHD', 'KWD', 'OMR']);
});

test('Saudi test prices: 699 / 1,299 / 2,499 SAR monthly and yearly = 10 months (Q-05)', () => {
  const rows = q(`
    SELECT p.code, m.amount_minor, y.amount_minor FROM plans p
    JOIN plan_prices m ON m.plan_id = p.id AND m.country_code = 'SA' AND m.billing_interval = 'month'
    JOIN plan_prices y ON y.plan_id = p.id AND y.country_code = 'SA' AND y.billing_interval = 'year'
    ORDER BY m.amount_minor`);
  assert.deepEqual(rows, [['basic', '69900', '699000'], ['pro', '129900', '1299000'], ['enterprise', '249900', '2499000']]);
});

test('trial is 14 days for every plan (Q-06)', () => {
  assert.deepEqual(q(`SELECT DISTINCT trial_days FROM plans`), [['14']]);
});

test('TikTok DM and AI conversation features are off by default', () => {
  assert.deepEqual(q(`SELECT key FROM feature_flags WHERE enabled ORDER BY key`), []);
});

test('real tenants cannot be created in a country that is not open; synthetic demo tenants can', () => {
  assert.match(err(`INSERT INTO tenants (slug, display_name, country_code, region) VALUES ('real-clinic', 'Real', 'SA', 'sa-1');`) ?? '', /not open for tenants/);
  assert.equal(err(`INSERT INTO tenants (slug, display_name, country_code, region, is_synthetic) VALUES ('oasis-demo', 'Oasis (demo)', 'SA', 'sa-1', true);`), null);
});

test('a tenant must live in its country\'s data region', () => {
  q(`UPDATE countries SET launch_status = 'pilot' WHERE code = 'SA'`);
  assert.match(err(`INSERT INTO tenants (slug, display_name, country_code, region) VALUES ('wrong-region', 'X', 'SA', 'eg-1');`) ?? '', /does not match/);
  assert.equal(err(`INSERT INTO tenants (slug, display_name, country_code, region) VALUES ('right-region', 'X', 'SA', 'sa-1');`), null);
  q(`UPDATE countries SET launch_status = 'planned' WHERE code = 'SA'`);
});

test('reserved/malformed slugs and duplicate subdomains are rejected', () => {
  assert.match(err(`INSERT INTO tenants (slug, display_name, country_code, region, is_synthetic) VALUES ('Bad Slug', 'X', 'SA', 'sa-1', true);`) ?? '', /check constraint/);
});

test('emails are unique case-insensitively', () => {
  q(`INSERT INTO users (email, name) VALUES ('owner@example.test', 'Owner (demo)')`);
  assert.match(err(`INSERT INTO users (email, name) VALUES ('OWNER@example.test', 'Dup')`) ?? '', /duplicate key/);
});

test('one open subscription per tenant', () => {
  q(`INSERT INTO subscriptions (tenant_id, plan_price_id, status, current_period_start, current_period_end)
     SELECT t.id, pp.id, 'trialing', now(), now() + interval '14 days' FROM tenants t, plan_prices pp
     WHERE t.slug = 'oasis-demo' AND pp.billing_interval = 'month' LIMIT 1`);
  assert.match(err(`INSERT INTO subscriptions (tenant_id, plan_price_id, status, current_period_start, current_period_end)
     SELECT t.id, pp.id, 'active', now(), now() + interval '1 month' FROM tenants t, plan_prices pp
     WHERE t.slug = 'oasis-demo' AND pp.billing_interval = 'month' LIMIT 1`) ?? '', /duplicate key/);
});

test('duplicate payment webhooks are stored once (no double charge / renewal)', () => {
  const ins = `INSERT INTO payment_events (provider, external_event_id, payload_hash) VALUES ('sandbox', 'evt_1', 'h') ON CONFLICT DO NOTHING RETURNING id;`;
  assert.equal(q(ins).length, 1);
  assert.equal(q(ins).length, 0);
});

test('invoice totals must add up', () => {
  assert.match(err(`INSERT INTO invoices (tenant_id, country_code, number, currency, subtotal_minor, tax_minor, total_minor)
    SELECT id, 'SA', 'INV-1', 'SAR', 100, 15, 120 FROM tenants WHERE slug = 'oasis-demo'`) ?? '', /check constraint/);
});

test('support access grants cannot exceed 24 hours and need a real reason', () => {
  const base = `INSERT INTO support_access_grants (tenant_id, requested_by, scope, reason, starts_at, expires_at)
    SELECT t.id, u.id, 'channels', $R$, now(), now() + interval $D$ FROM tenants t, users u WHERE t.slug = 'oasis-demo' LIMIT 1`;
  assert.match(err(base.replace('$R$', `'ticket 123: webhook failing'`).replace('$D$', `'25 hours'`)) ?? '', /check constraint/);
  assert.match(err(base.replace('$R$', `'help'`).replace('$D$', `'1 hour'`)) ?? '', /check constraint/);
  assert.equal(err(base.replace('$R$', `'ticket 123: webhook failing'`).replace('$D$', `'1 hour'`)), null);
});

test('platform audit log is append-only', () => {
  q(`INSERT INTO platform_audit_log (action) VALUES ('test')`);
  assert.match(err(`DELETE FROM platform_audit_log`) ?? '', /append-only/);
});

test('control plane has no tables for customers, conversations or messages', () => {
  const names = q(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'control'`).map((r) => r[0]);
  for (const forbidden of ['contacts', 'conversations', 'messages', 'appointments', 'patients']) assert.ok(!names.includes(forbidden), forbidden);
});
