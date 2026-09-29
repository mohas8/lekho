/**
 * Developer CLI: convert text with the Ridmik rules and default settings.
 *
 *   npm run ridmik -- "ami korrmo kori"      -> আমি কর্ম করি
 *   npm run ridmik -- --raw "2a"             -> letters only, digits/dots untouched
 */
import { ridmikToBangla } from '../src/engine/ridmik';
import { transliterate } from '../src/engine/transliterate';

const args = process.argv.slice(2);
const raw = args.includes('--raw');
const text = args.filter((a) => a !== '--raw').join(' ');

if (!text) {
  console.error('Usage: npm run ridmik -- [--raw] "<text>"');
  process.exit(1);
}

console.log(raw ? ridmikToBangla(text) : transliterate(text));
