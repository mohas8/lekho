import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { buildExtension } from '../../scripts/build';
import { checkReleasable, listFiles, packageExtension, zip } from '../../scripts/package';

/** Reads a zip written by zip() back into name -> content (enough for our own files). */
function unzip(buf: Buffer): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    expect(buf.readUInt32LE(p)).toBe(0x02014b50);
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extra = buf.readUInt16LE(p + 30);
    const comment = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString('utf8');
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtra = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtra;
    const data = buf.subarray(dataStart, dataStart + csize);
    out.set(name, method === 8 ? inflateRawSync(data) : Buffer.from(data));
    p += 46 + nameLen + extra + comment;
  }
  return out;
}

describe('zip writer', () => {
  it('round-trips files, including UTF-8 content', () => {
    const files = [
      { name: 'a.txt', data: Buffer.from('hello') },
      { name: 'dir/b.json', data: Buffer.from(JSON.stringify(['আমি', 'কর্ম'])) },
      { name: 'empty', data: Buffer.alloc(0) },
    ];
    const back = unzip(zip(files));
    expect([...back.keys()]).toEqual(['a.txt', 'dir/b.json', 'empty']);
    expect(back.get('dir/b.json')!.toString('utf8')).toBe('["আমি","কর্ম"]');
    expect(back.get('empty')!.length).toBe(0);
  });

  it('is deterministic', () => {
    const files = [{ name: 'x', data: Buffer.from('same') }];
    expect(zip(files).equals(zip(files))).toBe(true);
  });
});

describe('release package', () => {
  let work: string;
  let prod: string;
  let test: string;
  beforeAll(async () => {
    work = mkdtempSync(join(tmpdir(), 'lekho-pkg-'));
    prod = await buildExtension('production', join(work, 'prod'));
    test = await buildExtension('test', join(work, 'test'));
  });
  afterAll(() => rmSync(work, { recursive: true, force: true }));

  it('packages every built file, with a clean manifest and no test hooks', () => {
    const zipPath = packageExtension(prod, join(work, 'release'));
    expect(zipPath).toMatch(/lekho-\d+\.\d+\.\d+\.zip$/);
    const entries = unzip(readFileSync(zipPath));
    expect([...entries.keys()]).toEqual(listFiles(prod));

    const manifest = JSON.parse(entries.get('manifest.json')!.toString('utf8'));
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.permissions).toEqual(['activeTab', 'scripting', 'storage']);
    expect(manifest.host_permissions).toBeUndefined();
    expect(manifest.content_scripts).toBeUndefined();
    expect(manifest.name).not.toMatch(/test/i);

    for (const [name, data] of entries) {
      if (name.endsWith('.js')) expect(data.toString('utf8'), name).not.toContain('lekhoTest');
    }
    for (const f of ['LICENSE', 'THIRD_PARTY_NOTICES.md', 'PRIVACY.md', 'service-worker.js', 'content.js', 'options.html', 'dict/w_k.json']) {
      expect(entries.has(f), f).toBe(true);
    }
    // Everything the manifest refers to is in the package.
    const referenced = [manifest.background.service_worker, manifest.options_ui.page, ...Object.values(manifest.icons as Record<string, string>)];
    for (const f of referenced) expect(entries.has(f), f).toBe(true);
  });

  it('refuses a test build', () => {
    expect(() => checkReleasable(test)).toThrow(/host_permissions|test build/);
  });

  it('refuses unexpected permissions or leftover test hooks', () => {
    const copy = join(work, 'tampered');
    cpSync(prod, copy, { recursive: true });
    const m = JSON.parse(readFileSync(join(copy, 'manifest.json'), 'utf8'));
    writeFileSync(join(copy, 'manifest.json'), JSON.stringify({ ...m, permissions: [...m.permissions, 'tabs'] }));
    expect(() => checkReleasable(copy)).toThrow(/Unexpected permission: tabs/);

    writeFileSync(join(copy, 'manifest.json'), JSON.stringify(m));
    writeFileSync(join(copy, 'content.js'), readFileSync(join(copy, 'content.js'), 'utf8') + ';globalThis.__lekhoTest=1;');
    expect(() => checkReleasable(copy)).toThrow(/Test hooks/);
  });

  it('ships source maps nowhere and nothing outside the build', () => {
    const files = readdirSync(prod, { recursive: true }) as string[];
    expect(files.filter((f) => f.endsWith('.map'))).toEqual([]);
    expect(files.filter((f) => /node_modules|\.ts$/.test(f))).toEqual([]);
  });
});
