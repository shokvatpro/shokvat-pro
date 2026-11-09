/**
 * Minimal PostgreSQL helpers built on the `psql` CLI, so database tests run against a REAL PostgreSQL
 * (row-level security cannot be tested with mocks).
 *
 * - If TEST_PG_HOST/TEST_PG_PORT are set (CI service container), they are used.
 * - Otherwise a throw-away cluster is created with initdb in a temp directory and destroyed afterwards.
 */
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, chmodSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export type Pg = {
  host: string;
  port: number;
  /** Run SQL as a given role in a given database; returns rows as arrays of strings (psql -At). Throws on error. */
  query: (sql: string, opts?: { db?: string; user?: string }) => string[][];
  /** Same as query but returns the error message instead of throwing (or null if it succeeded). */
  error: (sql: string, opts?: { db?: string; user?: string }) => string | null;
  stop: () => void;
};

function findBin(name: string): string {
  const fromEnv = process.env.PG_BIN;
  if (fromEnv && existsSync(join(fromEnv, name))) return join(fromEnv, name);
  const base = '/usr/lib/postgresql';
  if (existsSync(base)) {
    const versions = readdirSync(base).sort((a, b) => Number(b) - Number(a));
    for (const v of versions) if (existsSync(join(base, v, 'bin', name))) return join(base, v, 'bin', name);
  }
  return name; // rely on PATH
}

const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;
const asPostgres = (bin: string, args: string[]) => (isRoot ? ['runuser', ['-u', 'postgres', '--', bin, ...args]] as const : [bin, args] as const);

function run(cmd: string, args: readonly string[], input?: string) {
  return spawnSync(cmd, args as string[], { input, encoding: 'utf8' });
}

export function startPostgres(): Pg {
  let host = process.env.TEST_PG_HOST;
  let port = Number(process.env.TEST_PG_PORT || 0);
  let dataDir: string | null = null;
  let socketDir: string | null = null;
  const superuser = process.env.TEST_PG_SUPERUSER || 'postgres';

  if (!host) {
    const root = mkdtempSync(join(tmpdir(), 'sp-pg-'));
    chmodSync(root, 0o777);
    dataDir = join(root, 'data');
    socketDir = root;
    port = 54000 + Math.floor(Math.random() * 900);
    const [initCmd, initArgs] = asPostgres(findBin('initdb'), ['-D', dataDir, '-U', 'postgres', '-A', 'trust', '--no-sync', '-E', 'UTF8', '--locale=C.UTF-8']);
    const init = run(initCmd, initArgs);
    if (init.status !== 0) throw new Error(`initdb failed: ${init.stderr}`);
    const [ctlCmd, ctlArgs] = asPostgres(findBin('pg_ctl'), [
      '-D', dataDir, '-w', '-l', join(root, 'pg.log'),
      '-o', `-p ${port} -k ${socketDir} -c listen_addresses='' -c fsync=off -c full_page_writes=off`, 'start',
    ]);
    const start = run(ctlCmd, ctlArgs);
    if (start.status !== 0) throw new Error(`pg_ctl start failed: ${start.stderr}\n${existsSync(join(root, 'pg.log')) ? readFileSync(join(root, 'pg.log'), 'utf8') : ''}`);
    host = socketDir;
  }

  const psql = (sql: string, opts: { db?: string; user?: string } = {}) =>
    run(findBin('psql'), ['-X', '-q', '-At', '-F', '\t', '-v', 'ON_ERROR_STOP=1', '-h', host!, '-p', String(port), '-U', opts.user ?? superuser, '-d', opts.db ?? 'postgres', '-f', '-'], sql);

  return {
    host: host!,
    port,
    query(sql, opts) {
      const r = psql(sql, opts);
      if (r.status !== 0) throw new Error(r.stderr.trim() || `psql exited ${r.status}`);
      return r.stdout.split('\n').filter((l) => l.length > 0).map((l) => l.split('\t'));
    },
    error(sql, opts) {
      const r = psql(sql, opts);
      return r.status === 0 ? null : r.stderr.trim();
    },
    stop() {
      if (dataDir) {
        const [cmd, args] = asPostgres(findBin('pg_ctl'), ['-D', dataDir, '-m', 'immediate', 'stop']);
        run(cmd, args);
        rmSync(join(dataDir, '..'), { recursive: true, force: true });
      }
    },
  };
}

/** Builds a transaction that sets the tenant context exactly like the API/worker will (SET LOCAL). */
export function inTenant(tenantId: string, sql: string, branchScope: string = 'all'): string {
  if (!/^[0-9a-f-]{36}$/i.test(tenantId)) throw new Error('tenantId must be a uuid');
  if (!/^(all|[0-9a-f,-]*)$/i.test(branchScope)) throw new Error('invalid branch scope');
  return `BEGIN;\nSET LOCAL app.tenant_id = '${tenantId}';\nSET LOCAL app.branch_scope = '${branchScope}';\n${sql}\nCOMMIT;\n`;
}

/** Applies every *.sql file of a migrations folder, in name order. */
export function applyMigrations(pg: Pg, dir: string, db: string): string[] {
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) pg.query(readFileSync(join(dir, f), 'utf8'), { db });
  return files;
}

export function hasPostgres(): boolean {
  if (process.env.TEST_PG_HOST) return true;
  try {
    execFileSync(findBin('initdb'), ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
