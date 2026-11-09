import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

type Json = { [k: string]: unknown };
export type ThemeName = 'light' | 'dark';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'tokens');

export function loadJson(rel: string): Json {
  return JSON.parse(readFileSync(join(root, rel), 'utf8')) as Json;
}

function isToken(node: unknown): node is { $value: unknown } {
  return typeof node === 'object' && node !== null && '$value' in node;
}

/** Flattens a DTCG tree into { 'color.navy.900': value }. Keys starting with `$` are metadata. */
export function flatten(tree: Json, prefix = ''): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, node] of Object.entries(tree)) {
    if (key.startsWith('$')) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if (isToken(node)) out[path] = node.$value;
    else if (typeof node === 'object' && node !== null) Object.assign(out, flatten(node as Json, path));
  }
  return out;
}

const REF = /^\{([^}]+)\}$/;

/** Resolves `{a.b.c}` references (recursively) against the primitive table. Throws on unknown or circular refs. */
export function resolveValue(value: unknown, table: Record<string, unknown>, seen: string[] = []): unknown {
  if (typeof value === 'string') {
    const m = REF.exec(value);
    if (!m || !m[1]) return value;
    const ref = m[1];
    if (seen.includes(ref)) throw new Error(`Circular token reference: ${[...seen, ref].join(' → ')}`);
    if (!(ref in table)) throw new Error(`Unknown token reference: {${ref}}`);
    return resolveValue(table[ref], table, [...seen, ref]);
  }
  if (Array.isArray(value)) return value.map((v) => resolveValue(v, table, seen));
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveValue(v, table, seen)]));
  }
  return value;
}

export function loadPrimitives(): Record<string, unknown> {
  const flat = flatten(loadJson('platform.json'));
  return Object.fromEntries(Object.entries(flat).map(([k, v]) => [k, resolveValue(v, flat)]));
}

export function loadTheme(name: ThemeName): Record<string, string> {
  const primitives = loadPrimitives();
  const flat = flatten(loadJson(`themes/${name}.json`));
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(flat)) {
    const resolved = resolveValue(v, primitives);
    if (typeof resolved !== 'string') throw new Error(`Theme token ${name}.${k} must resolve to a string`);
    out[k] = resolved.toUpperCase();
  }
  return out;
}
