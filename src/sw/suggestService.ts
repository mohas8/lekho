/**
 * Suggestion service in the service worker. Dictionary tables are packaged
 * with the extension (dist/dict/) and read on demand; nothing leaves the
 * device. Tables stay cached in memory until Chrome stops the worker, and are
 * read again on the next request after a restart.
 */
import { Dictionary, type TableLoader } from '../suggest/dictionary';
import { MAX_CANDIDATES, SuggestionEngine } from '../suggest/engine';
import { isValidRoman, MAX_WORD } from '../shared/messages';
import type { LearnedChoices } from './learned';

export interface SuggestResult {
  /** Candidates, best first; words[0] is the Ridmik output. */
  readonly words: readonly string[];
  /** Remembered choice to highlight by default. */
  readonly preferred?: string;
}

export interface SuggestService {
  /** null for invalid input. */
  suggest(roman: string): Promise<SuggestResult | null>;
  /** The user picked `word` for `roman`; remembered if it was one of the candidates offered. */
  learn(roman: string, word: string): Promise<void>;
}

export interface SuggestServiceOptions {
  learned?: LearnedChoices;
  /** Whether choices are remembered (the "Remember my choices" setting). */
  remember?: () => Promise<boolean>;
}

export function createSuggestService(loader: TableLoader, opts: SuggestServiceOptions = {}): SuggestService {
  const engine = new SuggestionEngine(new Dictionary(loader));
  const learned = opts.learned;
  const remember = opts.remember ?? (async () => true);

  const preferredFor = async (roman: string): Promise<string | undefined> =>
    learned && (await remember()) ? learned.preferred(roman) : undefined;

  return {
    async suggest(roman) {
      if (!isValidRoman(roman)) return null;
      const s = await engine.suggest(roman);
      let words = s.words;
      const pref = await preferredFor(roman);
      if (pref === undefined || pref === words[0]) return { words };
      if (pref !== roman && !words.includes(pref)) {
        // Keep a remembered word visible even if it no longer ranks in the top 9.
        words = [words[0] as string, pref, ...words.slice(1)].slice(0, MAX_CANDIDATES);
      }
      return { words, preferred: pref };
    },

    async learn(roman, word) {
      if (!learned || !isValidRoman(roman) || word.length === 0 || word.length > MAX_WORD) return;
      if (!(await remember())) return;
      const s = await engine.suggest(roman);
      const derived = await learned.preferred(roman);
      if (word !== roman && !s.words.includes(word) && word !== derived) return; // not something we offered

      if (word === s.words[0]) {
        // Back to the Ridmik output, the default: forget the direct entry, or
        // override a preference derived from a remembered base word.
        if ((await learned.get(roman)) !== undefined) await learned.forget(roman);
        else if (derived !== undefined && derived !== word) await learned.set(roman, word);
        return;
      }
      await learned.set(roman, word);
      // As Avro does: picking "কর্মকে" for "kormoke" also teaches কর্ম for "kormo", if nothing is known for it yet.
      const base = s.bases[word];
      if (base) await learned.setIfAbsent(base.roman, base.base);
    },
  };
}

/** Reads a packaged dictionary table (chrome-extension:// URL, never the network). */
export const packagedTableLoader: TableLoader = async (name) => {
  if (!/^[a-z]+$/.test(name)) throw new Error(`Invalid table name: ${name}`);
  const res = await fetch(chrome.runtime.getURL(`dict/w_${name}.json`));
  if (!res.ok) throw new Error(`Dictionary table ${name}: HTTP ${res.status}`);
  const words: unknown = await res.json();
  if (!Array.isArray(words)) throw new Error(`Dictionary table ${name} is not a list`);
  return words as string[];
};
