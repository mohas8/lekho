/**
 * Packages dist/ into release/lekho-<version>.zip for the Chrome Web Store.
 *
 *   npm run package      (builds the production extension first)
 *
 * Refuses to package a test build or a manifest with host permissions.
 * The zip is written with node:zlib (no extra dependencies); entries are
 * sorted and timestamps fixed, so the same input gives the same file.
 */
import { deflateRawSync, crc32 } from 'node:zlib';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');

/** Recursively lists files under dir (relative, forward slashes, sorted). */
export function listFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.isFile()) out.push(relative(dir, p).split(sep).join('/'));
    }
  };
  walk(dir);
  return out.sort();
}

/** Throws if dir is not a releasable production build. */
export function checkReleasable(dir: string): { name: string; version: string } {
  const manifestPath = join(dir, 'manifest.json');
  if (!existsSync(manifestPath)) throw new Error(`${dir} has no manifest.json; run npm run build`);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    name: string;
    version: string;
    host_permissions?: string[];
    content_scripts?: unknown[];
    permissions?: string[];
  };
  if (manifest.host_permissions?.length) throw new Error('Refusing to package: manifest has host_permissions (test build?)');
  if (manifest.content_scripts?.length) throw new Error('Refusing to package: manifest declares content_scripts');
  if (/test build/i.test(manifest.name)) throw new Error('Refusing to package a test build');
  const allowed = new Set(['activeTab', 'scripting', 'storage']);
  for (const p of manifest.permissions ?? []) if (!allowed.has(p)) throw new Error(`Unexpected permission: ${p}`);
  for (const f of listFiles(dir).filter((f) => f.endsWith('.js'))) {
    if (readFileSync(join(dir, f), 'utf8').includes('lekhoTest')) throw new Error(`Test hooks found in ${f}`);
  }
  return { name: manifest.name, version: manifest.version };
}

// Fixed timestamp (2026-01-01 00:00) in MS-DOS format.
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;

/** Minimal ZIP writer (deflate, no ZIP64: the extension is a few MB). */
export function zip(files: Array<{ name: string; data: Buffer }>): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const { name, data } of files) {
    const nameBuf = Buffer.from(name, 'utf8');
    const compressed = deflateRawSync(data, { level: 9 });
    const crc = crc32(data) >>> 0;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBuf, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30); // extra
    central.writeUInt16LE(0, 32); // comment
    central.writeUInt16LE(0, 34); // disk
    central.writeUInt16LE(0, 36); // internal attrs
    central.writeUInt32LE(0, 38); // external attrs
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);

    offset += local.length + nameBuf.length + compressed.length;
  }
  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuf, end]);
}

export function packageExtension(distDir: string, outDir: string): string {
  const { version } = checkReleasable(distDir);
  const files = listFiles(distDir).map((name) => ({ name, data: readFileSync(join(distDir, name)) }));
  mkdirSync(outDir, { recursive: true });
  const out = join(outDir, `lekho-${version}.zip`);
  writeFileSync(out, zip(files));
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = packageExtension(join(root, 'dist'), join(root, 'release'));
  console.log(`Packaged ${relative(root, out)} (${(statSync(out).size / 1024 / 1024).toFixed(2)} MiB)`);
}
