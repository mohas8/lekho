/**
 * Developer CLI: ranked suggestions for Ridmik-typed words.
 *
 *   npm run suggest -- kormo
 *   npm run suggest -- amader bhalobasa
 */
import { Dictionary } from '../src/suggest/dictionary';
import { SuggestionEngine } from '../src/suggest/engine';
import { readAvroDict } from './build-dict';

const words = process.argv.slice(2);
if (words.length === 0) {
  console.error('Usage: npm run suggest -- <word> [<word> ...]');
  process.exit(1);
}

const tables = readAvroDict();
const engine = new SuggestionEngine(new Dictionary(async (name) => tables[name] ?? []));

for (const w of words) {
  const t0 = performance.now();
  const s = await engine.suggest(w);
  const ms = (performance.now() - t0).toFixed(1);
  console.log(`${w}  (${ms} ms)`);
  s.words.forEach((c, i) => console.log(`  ${i + 1}. ${c}${i === 0 ? '   ← Ridmik' : ''}${s.bases[c] ? `   (${s.bases[c].base} + suffix)` : ''}`));
}
