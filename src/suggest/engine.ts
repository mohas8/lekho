/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Based on suggestionbuilder.js from ibus-avro (https://github.com/sarim/ibus-avro).
 * The Original Code is jsAvroPhonetic.
 * Initial Developer: Mehdi Hasan Khan <mhasan@omicronlab.com>
 * Copyright (C) OmicronLab (http://www.omicronlab.com). All Rights Reserved.
 *
 * Changes from the original:
 *  - The Ridmik output is candidate #1 (upstream puts Avro's own output last),
 *    so the default choice is always exactly what the Ridmik rules produce.
 *  - Candidates are ranked by edit distance to the Ridmik output.
 *  - No autocorrect table, no punctuation padding (the caller only sends
 *    letter runs), no file I/O; learned choices are handled by the caller.
 *  - Dictionary results are kept in a bounded LRU cache; suffix bases are
 *    looked up on demand instead of only when typed earlier.
 */
import { convertLetters } from '../engine/ridmik';
import { Dictionary } from './dictionary';
import { levenshtein } from './levenshtein';
import { searchKey } from './ridmikRegex';
import { SUFFIXES } from './data/suffixData';

export const MAX_CANDIDATES = 9;

export interface Suggestions {
  readonly roman: string;
  /** Candidates, best first. words[0] is always the Ridmik output for `roman`. */
  readonly words: readonly string[];
  /** For candidates built as dictionary word + suffix: the dictionary word and its English part. */
  readonly bases: Readonly<Record<string, { readonly base: string; readonly roman: string }>>;
}

const set = (codes: number[]) => new Set(codes.map((c) => String.fromCharCode(c)));
/** Vowel signs (kar). */
const KARS = set([0x9be, 0x9bf, 0x9c0, 0x9c1, 0x9c2, 0x9c3, 0x9c7, 0x9c8, 0x9cb, 0x9cc, 0x9c4]);
/** Independent vowels and vowel signs. */
const VOWELS_AND_KARS = set([
  0x985, 0x986, 0x987, 0x988, 0x989, 0x98a, 0x98b, 0x98f, 0x990, 0x993, 0x994, 0x98c, 0x9e1,
  0x9be, 0x9bf, 0x9c0, 0x9c1, 0x9c2, 0x9c3, 0x9c7, 0x9c8, 0x9cb, 0x9cc,
]);
const B_Y = '\u09df'; // য়
const KHANDATTA = '\u09ce'; // ৎ
const B_T = '\u09a4'; // ত
const ANUSHAR = '\u0982'; // ং
const B_NGA = '\u0999'; // ঙ

/** Joins a dictionary word and a Bangla suffix the way Avro does. */
export function joinSuffix(word: string, suffix: string): string {
  const last = word.slice(-1);
  const first = suffix.slice(0, 1);
  if (VOWELS_AND_KARS.has(last) && KARS.has(first)) return word + B_Y + suffix;
  if (last === KHANDATTA) return word.slice(0, -1) + B_T + suffix;
  if (last === ANUSHAR) return word.slice(0, -1) + B_NGA + suffix;
  return word + suffix;
}

/** Small LRU map. */
class Lru<V> {
  private readonly map = new Map<string, V>();
  constructor(private readonly max: number) {}
  get(key: string): V | undefined {
    const v = this.map.get(key);
    if (v !== undefined) {
      this.map.delete(key);
      this.map.set(key, v);
    }
    return v;
  }
  set(key: string, value: V): void {
    this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.max) this.map.delete(this.map.keys().next().value as string);
  }
}

export interface EngineOptions {
  limit?: number;
  cacheSize?: number;
}

export class SuggestionEngine {
  private readonly cache: Lru<Promise<readonly string[]>>;
  private readonly limit: number;

  constructor(
    private readonly dict: Dictionary,
    options: EngineOptions = {},
  ) {
    this.limit = options.limit ?? MAX_CANDIDATES;
    this.cache = new Lru(options.cacheSize ?? 2000);
  }

  /** Dictionary words for `roman`, cached. */
  lookup(roman: string): Promise<readonly string[]> {
    const key = searchKey(roman);
    let hit = this.cache.get(key);
    if (!hit) {
      hit = this.dict.search(roman);
      this.cache.set(key, hit);
      hit.catch(() => undefined);
    }
    return hit;
  }

  async suggest(roman: string): Promise<Suggestions> {
    const phonetic = convertLetters(roman);
    if (!/^[A-Za-z]+$/.test(roman)) return { roman, words: phonetic ? [phonetic] : [], bases: {} };

    const candidates: string[] = [...(await this.lookup(roman))];
    const bases: Record<string, { base: string; roman: string }> = {};

    // Dictionary word + suffix, e.g. "amader" = "ama" (আমা) + "der" (দের).
    const lower = roman.toLowerCase();
    for (let j = 1; j < roman.length; j++) {
      const suffix = SUFFIXES[lower.slice(j)];
      if (suffix === undefined) continue;
      const baseRoman = roman.slice(0, j);
      for (const base of await this.lookup(baseRoman)) {
        const full = joinSuffix(base, suffix);
        candidates.push(full);
        // Upstream doesn't remember bases ending in anushar; kept as is.
        if (base.slice(-1) !== ANUSHAR && !bases[full]) bases[full] = { base, roman: baseRoman };
      }
    }

    // Rank by closeness to the Ridmik output; stable, so ties keep dictionary order.
    const distance = new Map<string, number>();
    for (const w of candidates) if (!distance.has(w)) distance.set(w, levenshtein(phonetic, w));
    const ranked = [...distance.keys()].sort((a, b) => (distance.get(a) as number) - (distance.get(b) as number));

    const words = [phonetic, ...ranked.filter((w) => w !== phonetic)].slice(0, this.limit);
    const kept: Record<string, { base: string; roman: string }> = {};
    for (const w of words) {
      const b = bases[w];
      if (b) kept[w] = b;
    }
    return { roman, words, bases: kept };
  }
}
