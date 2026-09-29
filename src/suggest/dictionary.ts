/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Port of dbsearch.js from ibus-avro (https://github.com/sarim/ibus-avro).
 * The Original Code is jsAvroPhonetic.
 * Initial Developer: Mehdi Hasan Khan <mhasan@omicronlab.com>
 * Copyright (C) OmicronLab (http://www.omicronlab.com). All Rights Reserved.
 *
 * Changes from the original: tables are loaded on demand through a loader
 * (the extension fetches them from its own package), and the search pattern
 * comes from ridmikRegex.ts (Avro patterns plus Ridmik signs).
 */
import { ridmikSearchPattern } from './ridmikRegex';

/** Dictionary tables to search for each first English letter (from dbsearch.js). Table w_x holds words starting with one Bangla letter. */
export const TABLES_BY_FIRST_LETTER: Readonly<Record<string, readonly string[]>> = {
  a: ['a', 'aa', 'e', 'oi', 'o', 'nya', 'y'],
  b: ['b', 'bh'],
  c: ['c', 'ch', 'k'],
  d: ['d', 'dh', 'dd', 'ddh'],
  e: ['i', 'ii', 'e', 'y'],
  f: ['ph'],
  g: ['g', 'gh', 'j'],
  h: ['h'],
  i: ['i', 'ii', 'y'],
  j: ['j', 'jh', 'z'],
  k: ['k', 'kh'],
  l: ['l'],
  m: ['h', 'm'],
  n: ['n', 'nya', 'nga', 'nn'],
  o: ['a', 'u', 'uu', 'oi', 'o', 'ou', 'y'],
  p: ['p', 'ph'],
  q: ['k'],
  r: ['rri', 'h', 'r', 'rr', 'rrh'],
  s: ['s', 'sh', 'ss'],
  t: ['t', 'th', 'tt', 'tth', 'khandatta'],
  u: ['u', 'uu', 'y'],
  v: ['bh'],
  w: ['o'],
  x: ['e', 'k'],
  y: ['i', 'y'],
  z: ['h', 'j', 'jh', 'z'],
};

/** All table names that exist (w_<name>.json in the build). */
export const ALL_TABLES: readonly string[] = [...new Set(Object.values(TABLES_BY_FIRST_LETTER).flat())].sort();

export type TableLoader = (name: string) => Promise<readonly string[]>;

export class Dictionary {
  private readonly tables = new Map<string, Promise<readonly string[]>>();

  constructor(private readonly loader: TableLoader) {}

  /** Loads (once) and returns a table; a failed load is retried next time. */
  table(name: string): Promise<readonly string[]> {
    let t = this.tables.get(name);
    if (!t) {
      t = this.loader(name).catch((err: unknown) => {
        this.tables.delete(name);
        throw err;
      });
      this.tables.set(name, t);
    }
    return t;
  }

  /** Tables needed for words starting with this English letter. */
  static tablesFor(roman: string): readonly string[] {
    return TABLES_BY_FIRST_LETTER[roman.charAt(0).toLowerCase()] ?? [];
  }

  /** Makes sure the tables for this first letter are loaded. */
  async preload(roman: string): Promise<void> {
    await Promise.all(Dictionary.tablesFor(roman).map((t) => this.table(t)));
  }

  /** All dictionary words matching `roman`, in table order. */
  async search(roman: string): Promise<string[]> {
    const names = Dictionary.tablesFor(roman);
    if (names.length === 0) return [];
    const tables = await Promise.all(names.map((n) => this.table(n)));
    const re = ridmikSearchPattern(roman);
    const out: string[] = [];
    for (const words of tables) {
      for (const w of words) if (re.test(w)) out.push(w);
    }
    return out;
  }
}
