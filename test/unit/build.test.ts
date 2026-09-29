import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildExtension } from '../../scripts/build';

/** Recursively lists files under dir, relative paths. */
function files(dir: string, prefix = ''): string[] {
  return readdirSync(join(dir, prefix), { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? files(dir, join(prefix, d.name)) : [join(prefix, d.name)],
  );
}

describe('production build', () => {
  let out: string;
  beforeAll(async () => {
    out = mkdtempSync(join(tmpdir(), 'lekho-build-'));
    await buildExtension('production', out);
  });
  afterAll(() => rmSync(out, { recursive: true, force: true }));

  it('has no host permissions or content_scripts', () => {
    const manifest = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8'));
    expect(manifest.host_permissions).toBeUndefined();
    expect(manifest.content_scripts).toBeUndefined();
    expect(manifest.permissions).toEqual(['activeTab', 'scripting', 'storage']);
  });

  it('contains no test hooks', () => {
    for (const f of files(out).filter((f) => f.endsWith('.js'))) {
      const src = readFileSync(join(out, f), 'utf8');
      expect(src, f).not.toContain('__lekhoTest');
      expect(src, f).not.toContain('lekhoTest');
      expect(src, f).not.toContain('__lekho=');
    }
  });

  it('makes no network requests', () => {
    for (const f of files(out).filter((f) => f.endsWith('.js'))) {
      // XML namespace URIs are identifiers, not requests.
      const src = readFileSync(join(out, f), 'utf8').replaceAll('http://www.w3.org/', 'ns:');
      expect(src, f).not.toMatch(/\bXMLHttpRequest\b|\bWebSocket\b|\bsendBeacon\b|\bEventSource\b|https?:\/\//);
    }
  });
});
