/**
 * Learned choices: the candidate a user picked for an English word, so it is
 * highlighted by default next time. Stored only in chrome.storage.local on
 * this device, capped at MAX_LEARNED entries (least recently used dropped).
 *
 * Choosing the Ridmik output itself forgets the entry, since that is the
 * default anyway.
 */
import { SUFFIXES } from '../suggest/data/suffixData';
import { joinSuffix } from '../suggest/engine';
import { LEARNED_KEY } from '../shared/settings';

export { LEARNED_KEY };
export const MAX_LEARNED = 5000;

export type LearnedEntries = Array<[roman: string, word: string]>;

export interface LearnedStorage {
  load(): Promise<LearnedEntries>;
  save(entries: LearnedEntries): Promise<void>;
}

export class LearnedChoices {
  private map: Promise<Map<string, string>> | null = null;
  private writes: Promise<void> = Promise.resolve();

  constructor(
    private readonly storage: LearnedStorage,
    private readonly max = MAX_LEARNED,
  ) {}

  /** Drops the in-memory copy; the next call reads storage again (e.g. after "Clear learned words"). */
  invalidate(): void {
    this.map = null;
  }

  private load(): Promise<Map<string, string>> {
    if (!this.map) {
      this.map = this.storage
        .load()
        .then((entries) => new Map(Array.isArray(entries) ? entries.filter(isEntry) : []))
        .catch(() => new Map<string, string>());
    }
    return this.map;
  }

  async get(roman: string): Promise<string | undefined> {
    return (await this.load()).get(roman);
  }

  /**
   * The remembered choice for `roman`, or one derived from a remembered base
   * word plus a known suffix (as Avro does: having picked কর্ম for "kormo",
   * "kormoke" suggests কর্মকে).
   */
  async preferred(roman: string): Promise<string | undefined> {
    const map = await this.load();
    const direct = map.get(roman);
    if (direct !== undefined) return direct;
    for (let j = 1; j < roman.length; j++) {
      const suffix = SUFFIXES[roman.slice(-j).toLowerCase()];
      if (suffix === undefined) continue;
      const base = map.get(roman.slice(0, roman.length - j));
      if (base !== undefined) return joinSuffix(base, suffix);
    }
    return undefined;
  }

  async set(roman: string, word: string): Promise<void> {
    await this.update((map) => {
      map.delete(roman);
      map.set(roman, word);
      while (map.size > this.max) map.delete(map.keys().next().value as string);
    });
  }

  /** Remembers only if nothing is remembered for `roman` yet. */
  async setIfAbsent(roman: string, word: string): Promise<void> {
    if ((await this.get(roman)) !== undefined) return;
    await this.set(roman, word);
  }

  async forget(roman: string): Promise<void> {
    await this.update((map) => {
      map.delete(roman);
    });
  }

  async size(): Promise<number> {
    return (await this.load()).size;
  }

  /** Applies a change and saves; writes are serialized so concurrent tabs can't lose updates. */
  private update(change: (map: Map<string, string>) => void): Promise<void> {
    const run = this.writes.then(async () => {
      const map = await this.load();
      const before = JSON.stringify([...map]);
      change(map);
      const after = [...map];
      if (JSON.stringify(after) !== before) await this.storage.save(after);
    });
    this.writes = run.catch(() => undefined);
    return run;
  }
}

function isEntry(e: unknown): e is [string, string] {
  return Array.isArray(e) && e.length === 2 && typeof e[0] === 'string' && typeof e[1] === 'string';
}

export const chromeLearnedStorage: LearnedStorage = {
  async load() {
    const data = await chrome.storage.local.get(LEARNED_KEY);
    const v = data[LEARNED_KEY];
    return Array.isArray(v) ? (v as LearnedEntries) : [];
  },
  async save(entries) {
    await chrome.storage.local.set({ [LEARNED_KEY]: entries });
  },
};
