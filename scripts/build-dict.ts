/**
 * Converts the Avro dictionary (vendor/ibus-avro/avrodict.js, MPL-2.0) into
 * one JSON file per table, loaded on demand by the service worker:
 *
 *   <out>/dict/w_<table>.json   (a JSON array of words)
 *
 * Used by scripts/build.ts; can also be run alone:
 *   npx tsx scripts/build-dict.ts <outDir>
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ALL_TABLES } from '../src/suggest/dictionary';

const root = resolve(import.meta.dirname, '..');
const SOURCE = join(root, 'vendor/ibus-avro/avrodict.js');

let cached: Record<string, string[]> | undefined;

/** Parses avrodict.js ("var tables = {...};", plain JSON inside) into table name -> words. */
export function readAvroDict(): Record<string, string[]> {
  if (cached) return cached;
  const src = readFileSync(SOURCE, 'utf8').trim();
  const prefix = 'var tables = ';
  if (!src.startsWith(prefix)) throw new Error(`Unexpected format in ${SOURCE}`);
  const json = src.slice(prefix.length).replace(/;$/, '');
  const raw = JSON.parse(json) as Record<string, string[]>;
  const tables: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!k.startsWith('w_') || !Array.isArray(v)) throw new Error(`Unexpected table ${k}`);
    tables[k.slice(2)] = v;
  }
  cached = tables;
  return tables;
}

/** Writes the tables used by the search; returns the number of words and bytes written. */
export function writeDict(dictDir: string): { words: number; bytes: number; tables: number } {
  const tables = readAvroDict();
  mkdirSync(dictDir, { recursive: true });
  let words = 0;
  let bytes = 0;
  for (const name of ALL_TABLES) {
    const list = tables[name];
    if (!list) throw new Error(`Dictionary table w_${name} is missing`);
    const body = JSON.stringify(list);
    writeFileSync(join(dictDir, `w_${name}.json`), body);
    words += list.length;
    bytes += Buffer.byteLength(body);
  }
  return { words, bytes, tables: ALL_TABLES.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = process.argv[2] ?? join(root, 'dist');
  const r = writeDict(join(out, 'dict'));
  console.log(`wrote ${r.tables} tables, ${r.words} words, ${(r.bytes / 1024 / 1024).toFixed(2)} MiB to ${out}/dict`);
}
