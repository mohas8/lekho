/**
 * Builds the extension.
 *
 *   tsx scripts/build.ts --mode production   -> dist/
 *   tsx scripts/build.ts --mode test         -> dist-test/ (test hooks + localhost access)
 *
 * Each entry is bundled separately as a classic IIFE script: content scripts
 * injected with chrome.scripting.executeScript({files}) cannot be ES modules,
 * and a classic service worker keeps the manifest simple.
 */
import { build } from 'vite';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildManifest, type BuildMode } from '../src/manifest';
import { writeDict } from './build-dict';

const root = resolve(import.meta.dirname, '..');

export const ENTRIES = [
  { name: 'service-worker', entry: 'src/sw/index.ts' },
  { name: 'content', entry: 'src/content/index.ts' },
  { name: 'options', entry: 'src/options/options.ts' },
] as const;

export function outDirFor(mode: BuildMode): string {
  return join(root, mode === 'test' ? 'dist-test' : 'dist');
}

export async function buildExtension(mode: BuildMode, outDir: string = outDirFor(mode)): Promise<string> {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  for (const { name, entry } of ENTRIES) {
    await build({
      configFile: false,
      root,
      logLevel: 'warn',
      publicDir: false,
      define: { __TEST__: JSON.stringify(mode === 'test') },
      build: {
        outDir,
        emptyOutDir: false,
        target: 'chrome120',
        minify: mode === 'production',
        sourcemap: false,
        copyPublicDir: false,
        reportCompressedSize: false,
        lib: {
          entry: join(root, entry),
          formats: ['iife'],
          name: `lekho_${name.replace(/-/g, '_')}`,
          fileName: () => `${name}.js`,
        },
      },
    });
  }

  cpSync(join(root, 'src/options/options.html'), join(outDir, 'options.html'));
  cpSync(join(root, 'src/options/options.css'), join(outDir, 'options.css'));
  cpSync(join(root, 'static/icons'), join(outDir, 'icons'), { recursive: true });
  writeDict(join(outDir, 'dict'));
  // The package redistributes the ported Ridmik engine (BSD-3) and the Avro dictionary (MPL-2.0).
  for (const f of ['LICENSE', 'THIRD_PARTY_NOTICES.md', 'PRIVACY.md']) cpSync(join(root, f), join(outDir, f));

  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { version: string };
  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(buildManifest(mode, pkg.version), null, 2) + '\n');
  return outDir;
}

function parseMode(argv: string[]): BuildMode {
  const i = argv.indexOf('--mode');
  const mode = i >= 0 ? argv[i + 1] : 'production';
  if (mode !== 'production' && mode !== 'test') throw new Error(`Unknown --mode ${mode}`);
  return mode;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const mode = parseMode(process.argv.slice(2));
  const out = await buildExtension(mode);
  console.log(`Built ${mode} extension -> ${out}`);
}
