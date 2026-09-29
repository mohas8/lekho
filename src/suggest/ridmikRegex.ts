/*
 * Ridmik-aware fuzzy search pattern.
 *
 * The Avro patterns (avroRegex.ts) lower-case the input, so they can't see
 * Ridmik's case-sensitive or two-letter signs. This pre-pass rewrites them
 * before the Avro patterns run:
 *
 *   TH        -> ৎ (khondo-to)
 *   qq, cb    -> ঁ (chandrabindu)
 *   hs        -> ্ (explicit hasanta), except after letters Ridmik joins with h
 *   rr + consonant/end -> r (Avro's r already allows a reph: কর্ম for "korrmo")
 *
 * nj/nc (ঞ্জ/ঞ্চ) and every other Ridmik letter are already covered by the
 * Avro patterns.
 */
import { AvroRegex } from './avroRegex';
import { REGEX_DATA } from './data/regexData';

const KHANDATTA = '\uE000';
const CHANDRABINDU = '\uE001';
const HASANTA = '\uE002';

const FRAGMENTS: Readonly<Record<string, string>> = {
  [KHANDATTA]: '(ৎ|(ত্?))',
  [CHANDRABINDU]: 'ঁ',
  [HASANTA]: '(্?)',
};

/** Letters Ridmik joins with a following h (kh, gh, ch, jh, Th, th, Dh, dh, ph, bh, sh, Sh, Rh), after its case folding. */
const H_DIGRAPH_STARTERS = new Set('kgcjTtDdpbsSRKCPB'.split(''));
const VOWELS = new Set('aeiouAEIOU'.split(''));

/** Rewrites Ridmik-only signs into placeholders the Avro parser passes through. */
export function ridmikPrepass(roman: string): string {
  let out = '';
  for (let i = 0; i < roman.length; i++) {
    const c = roman[i] as string;
    const next = roman[i + 1];
    const pair = c + (next ?? '');
    if (pair === 'TH') {
      out += KHANDATTA;
      i++;
    } else if (/^[qQ]{2}$/.test(pair) || /^[cC][bB]$/.test(pair)) {
      out += CHANDRABINDU;
      i++;
    } else if (/^[hH]s$/.test(pair) && !H_DIGRAPH_STARTERS.has(roman[i - 1] ?? '')) {
      out += HASANTA;
      i++;
    } else if (pair === 'rr' && roman[i + 2] !== 'i' && !VOWELS.has(roman[i + 2] ?? '') && roman[i - 1] !== 'r') {
      out += 'r';
      i++;
    } else {
      out += c;
    }
  }
  return out;
}

const avro = new AvroRegex(REGEX_DATA);

/** Normalized form of `roman` for caching: equal keys produce the same pattern. */
export function searchKey(roman: string): string {
  return ridmikPrepass(roman).toLowerCase();
}

/** Anchored regular expression matching dictionary spellings of a Ridmik-typed word. */
export function ridmikSearchPattern(roman: string): RegExp {
  const source = avro.parse(ridmikPrepass(roman)).replace(/[\uE000-\uE002]/g, (ph) => FRAGMENTS[ph] ?? '');
  return new RegExp(`^${source}$`);
}
