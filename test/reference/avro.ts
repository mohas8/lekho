/**
 * Test-only loader for the upstream ibus-avro AvroRegex (vendor/ibus-avro,
 * MPL-2.0), evaluated unmodified except for its GJS import line.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { runInNewContext } from 'node:vm';

const vendor = resolve(import.meta.dirname, '../../vendor/ibus-avro');

/** Returns upstream AvroRegex.parse, which emits \u0XXX escapes for Bangla characters. */
export function loadUpstreamAvroRegex(): (input: string) => string {
  const src = readFileSync(join(vendor, 'avroregexlib.js'), 'utf8').replace(/^const utfconv = imports\.utf8;$/m, '');
  const sandbox: { utfconv: { utf8Decode(s: string): string }; __regex?: { parse(s: string): string } } = {
    // In GJS this decodes UTF-8 byte strings; in Node the text is already decoded.
    utfconv: { utf8Decode: (s) => s },
  };
  runInNewContext(`${src}\n;this.__regex = new AvroRegex();`, sandbox);
  const r = sandbox.__regex;
  if (!r) throw new Error('upstream AvroRegex failed to load');
  return (input) => r.parse(input);
}

/** Upstream's output escaping, to compare our literal-character output against it. */
export function escapeLikeUpstream(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    out += code >= 255 ? '\\u0' + code.toString(16) : s.charAt(i);
  }
  return out;
}
