import { beforeAll, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AvroRegex } from '../../src/suggest/avroRegex';
import { REGEX_DATA } from '../../src/suggest/data/regexData';
import { ALL_TABLES, Dictionary } from '../../src/suggest/dictionary';
import { joinSuffix, MAX_CANDIDATES, SuggestionEngine } from '../../src/suggest/engine';
import { levenshtein } from '../../src/suggest/levenshtein';
import { ridmikPrepass, ridmikSearchPattern } from '../../src/suggest/ridmikRegex';
import { convertLetters } from '../../src/engine/ridmik';
import { readAvroDict, writeDict } from '../../scripts/build-dict';
import { escapeLikeUpstream, loadUpstreamAvroRegex } from '../reference/avro';

const tables = readAvroDict();
const newEngine = () => new SuggestionEngine(new Dictionary(async (name) => tables[name] ?? []));

describe('AvroRegex port', () => {
  const upstream = loadUpstreamAvroRegex();
  const ours = new AvroRegex(REGEX_DATA);

  it('matches upstream ibus-avro on 3,000 random inputs', () => {
    const input = fc.string({ unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzAEIOUDTNRS0123456789`,.-'.split('')), maxLength: 12 });
    fc.assert(
      fc.property(input, (s) => escapeLikeUpstream(ours.parse(s)) === upstream(s)),
      { numRuns: 3_000, seed: 42 },
    );
  });

  it('treats a word-initial "o" as a real vowel, a later one as optional', () => {
    const O = '([ওোঅ]|(অ্য)|(\u09dfো?))';
    expect(ours.parse('o')).toBe(`${O}(্[যবম])?(্?)([ঃঁ]?)`);
    expect(ours.parse('ko')).toContain(`${O}?`);
  });
});

describe('Ridmik search pattern', () => {
  it('rewrites Ridmik-only signs', () => {
    expect(ridmikPrepass('hoThaTH')).toBe('hoTha\uE000');
    expect(ridmikPrepass('caqqd')).toBe('ca\uE001d');
    expect(ridmikPrepass('caQQd')).toBe('ca\uE001d');
    expect(ridmikPrepass('cacbd')).toBe('ca\uE001d');
    expect(ridmikPrepass('mhsl')).toBe('m\uE002l');
    expect(ridmikPrepass('korrmo')).toBe('kormo');
    expect(ridmikPrepass('korr')).toBe('kor');
  });

  it('leaves Ridmik digraphs that only look similar alone', () => {
    expect(ridmikPrepass('khs')).toBe('khs'); // kh + s
    expect(ridmikPrepass('Th')).toBe('Th'); // ঠ, not ৎ
    expect(ridmikPrepass('krri')).toBe('krri'); // ৃ
    expect(ridmikPrepass('korra')).toBe('korra');
  });

  it('matches the intended spellings', () => {
    expect(ridmikSearchPattern('korrmo').test('কর্ম')).toBe(true);
    expect(ridmikSearchPattern('kormo').test('করম')).toBe(true);
    expect(ridmikSearchPattern('hoThaTH').test('হঠাৎ')).toBe(true);
    expect(ridmikSearchPattern('caqqd').test('চাঁদ')).toBe(true);
    expect(ridmikSearchPattern('gonj').test('গঞ্জ')).toBe(true);
    expect(ridmikSearchPattern('ami').test('তুমি')).toBe(false);
  });
});

describe('levenshtein (Damerau)', () => {
  it.each([
    ['', 'abc', 3],
    ['abc', '', 3],
    ['kitten', 'sitting', 3],
    ['ab', 'ba', 1],
    ['করম', 'কর্ম', 1],
    ['same', 'same', 0],
  ])('%s vs %s = %i', (a, b, d) => {
    expect(levenshtein(a, b)).toBe(d);
  });
});

describe('joinSuffix', () => {
  it('follows the Avro joining rules', () => {
    expect(joinSuffix('আমা', 'দের')).toBe('আমাদের');
    expect(joinSuffix('মা', 'ে')).toBe('মা\u09dfে'); // vowel + kar -> য় between
    expect(joinSuffix('জগৎ', 'ের')).toBe('জগতের'); // ৎ -> ত
    expect(joinSuffix('রং', 'ের')).toBe('রঙের'); // ং -> ঙ
  });
});

describe('SuggestionEngine', () => {
  let engine: SuggestionEngine;
  beforeAll(() => {
    engine = newEngine();
  });

  it('kormo: the Ridmik output করম first, then কর্ম', async () => {
    const s = await engine.suggest('kormo');
    expect(s.words[0]).toBe('করম');
    expect(s.words).toContain('কর্ম');
  });

  it('korrmo: কর্ম first', async () => {
    expect((await engine.suggest('korrmo')).words[0]).toBe('কর্ম');
  });

  it('bhalobasha and bhalobasa include ভালোবাসা', async () => {
    expect((await engine.suggest('bhalobasha')).words).toContain('ভালোবাসা');
    expect((await engine.suggest('bhalobasa')).words).toEqual(['ভালবাসা', 'ভালোবাসা']);
  });

  it('amader includes আমাদের, built from আমা + দের', async () => {
    const s = await engine.suggest('amader');
    expect(s.words).toContain('আমাদের');
    expect(s.bases['আমাদের']).toEqual({ base: 'আমা', roman: 'ama' });
  });

  it('finds words with Ridmik-only signs', async () => {
    expect((await engine.suggest('caqqd')).words).toContain('চাঁদ');
    expect((await engine.suggest('hoThaTH')).words).toContain('হঠাৎ');
    expect((await engine.suggest('porikkha')).words).toContain('পরীক্ষা');
  });

  it('never returns more than 9 candidates or duplicates, and #1 is always the Ridmik output', async () => {
    const words = fc.string({ unit: fc.constantFrom(...'abcdeghiklmnoprstuyABDEINOSTU'.split('')), minLength: 1, maxLength: 8 });
    await fc.assert(
      fc.asyncProperty(words, async (w) => {
        const s = await engine.suggest(w);
        return (
          s.words.length >= 1 &&
          s.words.length <= MAX_CANDIDATES &&
          new Set(s.words).size === s.words.length &&
          s.words[0] === convertLetters(w)
        );
      }),
      { numRuns: 300, seed: 5 },
    );
  });

  it('returns only the conversion for input the dictionary cannot hold', async () => {
    expect((await engine.suggest('qqqqqqqq')).words).toEqual([convertLetters('qqqqqqqq')]);
    expect((await engine.suggest('')).words).toEqual([]);
  });

  it('answers a 10-letter query in under 10 ms once its tables are loaded', async () => {
    const e = newEngine();
    const queries = ['bangladesh', 'shadhinota', 'bhalobashi', 'porikkhara', 'sOngbadTa', 'amaderkei'];
    await e.suggest('kichu'); // JIT warm-up
    for (const q of queries) await new Dictionary(async (n) => tables[n] ?? []).preload(q);
    const times: number[] = [];
    for (const q of queries) {
      const fresh = newEngine();
      await fresh.suggest(q.slice(0, 1)); // loads the tables, leaves the query itself uncached
      const t0 = performance.now();
      await fresh.suggest(q);
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    expect(times[Math.floor(times.length / 2)], `times: ${times.map((t) => t.toFixed(1)).join(', ')}`).toBeLessThan(10);
  });
});

describe('Dictionary', () => {
  it('loads each table once and retries a failed load', async () => {
    let calls = 0;
    let fail = true;
    const d = new Dictionary(async (name) => {
      calls++;
      if (fail) throw new Error('offline');
      return tables[name] ?? [];
    });
    await expect(d.table('k')).rejects.toThrow('offline');
    fail = false;
    await d.table('k');
    await d.table('k');
    expect(calls).toBe(2);
  });

  it('searches the tables for the first letter', async () => {
    expect(Dictionary.tablesFor('Kormo')).toEqual(['k', 'kh']);
    expect(Dictionary.tablesFor('9')).toEqual([]);
    const d = new Dictionary(async (name) => tables[name] ?? []);
    expect(await d.search('kormo')).toContain('কর্ম');
  });
});

describe('build-dict', () => {
  it('writes every table the search uses, and nothing else', () => {
    expect(new Set(ALL_TABLES)).toEqual(new Set(Object.keys(tables)));
    const out = mkdtempSync(join(tmpdir(), 'lekho-dict-'));
    try {
      const r = writeDict(out);
      const files = readdirSync(out).sort();
      expect(files).toEqual(ALL_TABLES.map((t) => `w_${t}.json`).sort());
      const total = Object.values(tables).reduce((n, t) => n + t.length, 0);
      expect(r.words).toBe(total);
      expect(total).toBeGreaterThan(150_000);
      expect(JSON.parse(readFileSync(join(out, 'w_k.json'), 'utf8'))).toEqual(tables.k);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });
});
