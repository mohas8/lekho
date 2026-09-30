/**
 * The Lekho website (served at https://mobashir.dev/lekho/, hosted on GitHub Pages).
 *
 *   npx vite --config site/vite.config.ts           dev server
 *   npx vite build --config site/vite.config.ts     -> site/dist/
 *
 * Every asset path starts with /lekho/, so the same build works on
 * mohas8.github.io/lekho/ and when mobashir.dev/lekho/ proxies to it.
 */
import { defineConfig, type Plugin } from 'vite';
import { cpSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { writeDict } from '../scripts/build-dict';

const here = resolve(import.meta.dirname);
const root = resolve(here, '..');
const outDir = join(here, 'dist');

/** Copies the dictionary and the screenshots into the build. */
function lekhoAssets(): Plugin {
  return {
    name: 'lekho-assets',
    apply: 'build',
    closeBundle() {
      writeDict(join(outDir, 'dict'));
      mkdirSync(join(outDir, 'img'), { recursive: true });
      for (const f of ['screenshot-1-typing.png', 'screenshot-2-suggestions.png', 'screenshot-4-avro-guide.png', 'promo-marquee-1400x560.png']) {
        cpSync(join(root, 'docs/store', f), join(outDir, 'img', f));
      }
      cpSync(join(root, 'static/icons/icon128.png'), join(outDir, 'img/icon128.png'));
      cpSync(join(root, 'static/icons/icon32.png'), join(outDir, 'favicon.png'));
    },
  };
}

export default defineConfig({
  root: here,
  base: '/lekho/',
  publicDir: join(here, 'public'),
  define: { __TEST__: 'false' },
  plugins: [lekhoAssets()],
  build: { outDir, emptyOutDir: true, target: 'es2022', reportCompressedSize: false },
  preview: { port: 4174, strictPort: true },
});
