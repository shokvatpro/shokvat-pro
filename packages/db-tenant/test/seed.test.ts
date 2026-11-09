import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startPostgres, inTenant, applyMigrations, type Pg } from '../../db-tools/src/pg.ts';

const DB = 'sp_seed_test';
const here = dirname(fileURLToPath(import.meta.url));
const OASIS = 'd1000000-0000-4000-8000-000000000001';
const RAYAN = 'd3000000-0000-4000-8000-000000000001';
let pg: Pg;
const asApp = (t: string, sql: string) => pg.query(inTenant(t, sql), { db: DB, user: 'sp_app' });

before(() => {
  pg = startPostgres();
  pg.query(`DROP DATABASE IF EXISTS ${DB}; CREATE DATABASE ${DB};`);
  applyMigrations(pg, join(here, '..', 'migrations'), DB);
  pg.query(readFileSync(join(here, '..', 'seed', 'demo.sql'), 'utf8'), { db: DB });
});
after(() => pg?.stop());

test('demo seed creates three synthetic tenants only', () => {
  assert.deepEqual(pg.query(`SELECT count(*), bool_and(is_synthetic) FROM tenant.tenant_settings`, { db: DB }), [['3', 't']]);
});

test('each demo tenant sees exactly its own 5 conversations', () => {
  assert.equal(asApp(OASIS, `SELECT count(*) FROM tenant.conversations;`)[0]?.[0], '5');
  assert.equal(asApp(RAYAN, `SELECT count(*) FROM tenant.conversations;`)[0]?.[0], '5');
});

test('inbox query: awaiting agent first, SLA breach flagged', () => {
  const rows = asApp(OASIS, `SELECT c.display_name, cv.sla_breached FROM tenant.conversations cv JOIN tenant.contacts c ON c.tenant_id = cv.tenant_id AND c.id = cv.contact_id
                             WHERE cv.awaiting_agent ORDER BY cv.sla_breached DESC, cv.last_inbound_at ASC;`);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0], ['سارة م.', 't']);
});

test('default roles follow the permission matrix', () => {
  const perms = (role: string) => asApp(OASIS, `SELECT rp.permission_key FROM tenant.role_permissions rp JOIN tenant.roles r ON r.tenant_id = rp.tenant_id AND r.id = rp.role_id WHERE r.key = '${role}' ORDER BY 1;`).map((r) => r[0]);
  assert.ok(!perms('receptionist').includes('contacts.export'), 'receptionist must not export');
  assert.ok(perms('center_admin').includes('contacts.export'));
  const marketing = perms('marketing');
  assert.ok(marketing.every((p) => !p!.startsWith('inbox.') && !p!.startsWith('contacts.')), 'marketing must not read conversations or contacts');
  assert.equal(asApp(OASIS, `SELECT count(*) FROM tenant.roles WHERE is_system;`)[0]?.[0], '6');
});

test('all demo channels are mock, none live', () => {
  assert.deepEqual(pg.query(`SELECT DISTINCT mode FROM tenant.channel_accounts`, { db: DB }), [['mock']]);
});
