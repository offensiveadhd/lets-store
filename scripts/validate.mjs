#!/usr/bin/env node
/**
 * validate.mjs — validate lets-store's index.json against the store-index
 * schema, plus store-level invariants the schema cannot express:
 *
 *   - every unique `name` is unique within the index
 *   - every `repo` starts with https://, git@, or ssh://
 *
 * Zero dependencies. Run:  node scripts/validate.mjs
 * Exits 0 on success, 1 on any problem.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

// ---------------------------------------------------------------------------
// Small JSON-Schema (2020-12 subset) validator — copied from
// lets/engine/src/validate.mjs. Supported: type, required, properties,
// additionalProperties (false|schema), items, minItems, maxItems, enum,
// const, pattern, minLength, maxLength, minimum, maximum, anyOf, oneOf,
// allOf, not, $ref (local "#/..." only).
// ---------------------------------------------------------------------------
export function validate(schema, value, root = schema, path = '$') {
  const errors = [];
  check(schema, value, root, path, errors);
  return { ok: errors.length === 0, errors };
}

function resolveRef(ref, root) {
  if (!ref.startsWith('#/')) throw new Error(`only local refs supported: ${ref}`);
  let cur = root;
  for (const part of ref.slice(2).split('/')) {
    cur = cur?.[part.replace(/~1/g, '/').replace(/~0/g, '~')];
    if (cur === undefined) throw new Error(`unresolved ref: ${ref}`);
  }
  return cur;
}

function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  return typeof v;
}

function typeMatches(expected, v) {
  const t = typeOf(v);
  if (expected === 'number') return t === 'number' || t === 'integer';
  return expected === t;
}

function check(schema, v, root, path, errors) {
  if (schema === true) return;
  if (schema === false) { errors.push(`${path}: schema forbids value`); return; }
  if (schema.$ref) { check(resolveRef(schema.$ref, root), v, root, path, errors); return; }

  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => typeMatches(t, v))) {
      errors.push(`${path}: expected ${types.join('|')}, got ${typeOf(v)}`);
      return;
    }
  }
  if (schema.const !== undefined && JSON.stringify(v) !== JSON.stringify(schema.const)) {
    errors.push(`${path}: must equal ${JSON.stringify(schema.const)}`);
  }
  if (schema.enum && !schema.enum.some((e) => JSON.stringify(e) === JSON.stringify(v))) {
    errors.push(`${path}: must be one of ${schema.enum.map((e) => JSON.stringify(e)).join(', ')}`);
  }
  if (typeof v === 'string') {
    if (schema.minLength !== undefined && v.length < schema.minLength) errors.push(`${path}: shorter than ${schema.minLength}`);
    if (schema.maxLength !== undefined && v.length > schema.maxLength) errors.push(`${path}: longer than ${schema.maxLength}`);
    if (schema.pattern && !new RegExp(schema.pattern).test(v)) errors.push(`${path}: does not match /${schema.pattern}/`);
  }
  if (typeof v === 'number') {
    if (schema.minimum !== undefined && v < schema.minimum) errors.push(`${path}: below ${schema.minimum}`);
    if (schema.maximum !== undefined && v > schema.maximum) errors.push(`${path}: above ${schema.maximum}`);
  }
  if (Array.isArray(v)) {
    if (schema.minItems !== undefined && v.length < schema.minItems) errors.push(`${path}: fewer than ${schema.minItems} items`);
    if (schema.maxItems !== undefined && v.length > schema.maxItems) errors.push(`${path}: more than ${schema.maxItems} items`);
    if (schema.items) v.forEach((item, i) => check(schema.items, item, root, `${path}[${i}]`, errors));
  }
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    for (const req of schema.required || []) {
      if (!(req in v)) errors.push(`${path}: missing required "${req}"`);
    }
    const props = schema.properties || {};
    for (const [k, sub] of Object.entries(props)) {
      if (k in v) check(sub, v[k], root, `${path}.${k}`, errors);
    }
    if (schema.additionalProperties !== undefined && schema.additionalProperties !== true) {
      for (const k of Object.keys(v)) {
        if (k in props) continue;
        if (schema.additionalProperties === false) errors.push(`${path}: unexpected property "${k}"`);
        else check(schema.additionalProperties, v[k], root, `${path}.${k}`, errors);
      }
    }
  }
  if (schema.allOf) for (const s of schema.allOf) check(s, v, root, path, errors);
  if (schema.anyOf) {
    const ok = schema.anyOf.some((s) => validate(s, v, root, path).ok);
    if (!ok) errors.push(`${path}: matches none of anyOf`);
  }
  if (schema.oneOf) {
    const n = schema.oneOf.filter((s) => validate(s, v, root, path).ok).length;
    if (n !== 1) errors.push(`${path}: matches ${n} of oneOf, need exactly 1`);
  }
  if (schema.not && validate(schema.not, v, root, path).ok) errors.push(`${path}: must not match "not" schema`);
}

// ---------------------------------------------------------------------------
// Store-level checks
// ---------------------------------------------------------------------------
const REPO_RE = /^(https:\/\/|git@|ssh:\/\/)/;

function main() {
  const problems = [];

  let index;
  try {
    index = JSON.parse(readFileSync(join(root, 'index.json'), 'utf8'));
  } catch (e) {
    console.error(`index.json: cannot read/parse: ${e.message}`);
    process.exit(1);
  }

  let schema;
  try {
    schema = JSON.parse(readFileSync(join(root, 'schema', 'store-index.schema.json'), 'utf8'));
  } catch (e) {
    console.error(`schema/store-index.schema.json: cannot read/parse: ${e.message}`);
    process.exit(1);
  }

  // 1. schema validation
  const res = validate(schema, index);
  if (!res.ok) problems.push(...res.errors);

  // 2. unique names
  const uniques = Array.isArray(index.uniques) ? index.uniques : [];
  const seen = new Map();
  for (const u of uniques) {
    if (u && typeof u.name === 'string') {
      if (seen.has(u.name)) problems.push(`uniques[${seen.get(u.name)}] and this entry share name "${u.name}": names must be unique`);
      else seen.set(u.name, uniques.indexOf(u));
    }
  }

  // 3. repo transport
  uniques.forEach((u, i) => {
    if (u && typeof u.repo === 'string' && !REPO_RE.test(u.repo)) {
      problems.push(`uniques[${i}].repo "${u.repo}": must be an https://, git@, or ssh:// URL`);
    }
  });

  if (problems.length) {
    console.error(`index.json: ${problems.length} problem(s):`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(`ok: index.json valid — store "${index.store}", ${uniques.length} unique(s)`);
}

main();
