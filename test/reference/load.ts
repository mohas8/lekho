/**
 * Test-only loader for the original Ridmik Parser JavaScript implementation
 * (BSD-3-Clause, Copyright (c) 2012 Shamim Hasnath; see ./LICENSE).
 *
 * The three original files are evaluated unmodified in an isolated VM context
 * so the port in src/engine can be compared against them byte-for-byte.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

const FILES = ['StringBuilder.js', 'ridmikmap.js', 'ridmikparser.js'];

export function loadReferenceParser(): (input: string) => string {
  const source =
    FILES.map((f) => readFileSync(join(import.meta.dirname, f), 'utf8')).join('\n;\n') +
    '\n;globalThis.__parser = new RidmikParser();';
  const sandbox: { __parser?: { toBangla(s: string): string } } = {};
  runInNewContext(source, sandbox, { filename: 'ridmik-reference.js' });
  const parser = sandbox.__parser;
  if (!parser) throw new Error('Reference parser failed to load');
  return (input) => parser.toBangla(input);
}
