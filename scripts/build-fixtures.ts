/**
 * Bundles the framework-based fixture pages (React) used by the e2e tests into
 * test/fixtures/dist/. Plain HTML fixtures need no build.
 */
import { build } from 'vite';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

const FIXTURE_ENTRIES = [
  { name: 'react-app', entry: 'test/fixtures/src/react-app.ts' },
  { name: 'editors', entry: 'test/fixtures/src/editors.ts' },
];

export async function buildFixtures(): Promise<void> {
  for (const { name, entry } of FIXTURE_ENTRIES) {
    const file = join(root, entry);
    if (!existsSync(file)) continue;
    await build({
      configFile: false,
      root,
      logLevel: 'warn',
      publicDir: false,
      define: { 'process.env.NODE_ENV': JSON.stringify('development') },
      build: {
        outDir: join(root, 'test/fixtures/dist'),
        emptyOutDir: false,
        minify: false,
        reportCompressedSize: false,
        lib: { entry: file, formats: ['iife'], name: `fixture_${name.replace(/-/g, '_')}`, fileName: () => `${name}.js` },
      },
    });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await buildFixtures();
  console.log('Built fixtures');
}
