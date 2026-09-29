import { beforeEach, describe, expect, it } from 'vitest';
import { LearnedChoices, type LearnedEntries, type LearnedStorage } from '../../src/sw/learned';
import { createSuggestService } from '../../src/sw/suggestService';
import { readAvroDict } from '../../scripts/build-dict';

class MemoryStorage implements LearnedStorage {
  entries: LearnedEntries = [];
  saves = 0;
  async load() {
    return structuredClone(this.entries);
  }
  async save(entries: LearnedEntries) {
    this.saves++;
    this.entries = structuredClone(entries);
  }
}

describe('LearnedChoices', () => {
  let storage: MemoryStorage;
  let learned: LearnedChoices;
  beforeEach(() => {
    storage = new MemoryStorage();
    learned = new LearnedChoices(storage, 3);
  });

  it('remembers, updates and forgets choices', async () => {
    await learned.set('kormo', 'কর্ম');
    expect(await learned.get('kormo')).toBe('কর্ম');
    await learned.set('kormo', 'ক্রম');
    expect(await learned.get('kormo')).toBe('ক্রম');
    await learned.forget('kormo');
    expect(await learned.get('kormo')).toBeUndefined();
    expect(storage.entries).toEqual([]);
  });

  it('keeps at most `max` entries, dropping the least recently used', async () => {
    await learned.set('a', '1');
    await learned.set('b', '2');
    await learned.set('c', '3');
    await learned.set('a', '1'); // a is now the most recent
    await learned.set('d', '4');
    expect(storage.entries.map(([k]) => k)).toEqual(['c', 'a', 'd']);
  });

  it('setIfAbsent never overwrites', async () => {
    await learned.set('kormo', 'কর্ম');
    await learned.setIfAbsent('kormo', 'ক্রম');
    await learned.setIfAbsent('dhormo', 'ধর্ম');
    expect(await learned.get('kormo')).toBe('কর্ম');
    expect(await learned.get('dhormo')).toBe('ধর্ম');
  });

  it('derives a choice for base word + suffix', async () => {
    await learned.set('kormo', 'কর্ম');
    expect(await learned.preferred('kormoke')).toBe('কর্মকে');
    expect(await learned.preferred('kormer')).toBeUndefined(); // "kormer" isn't "kormo" + suffix
    await learned.set('kormoke', 'করমকে');
    expect(await learned.preferred('kormoke')).toBe('করমকে'); // a direct entry wins
  });

  it('survives a restart and ignores malformed stored data', async () => {
    await learned.set('kormo', 'কর্ম');
    expect(await new LearnedChoices(storage).get('kormo')).toBe('কর্ম');
    storage.entries = [['ok', 'ঠিক'], ['bad'], 'x', [1, 2]] as unknown as LearnedEntries;
    const fresh = new LearnedChoices(storage);
    expect(await fresh.size()).toBe(1);
  });

  it('re-reads storage after invalidate() (e.g. cleared from the options page)', async () => {
    await learned.set('kormo', 'কর্ম');
    storage.entries = [];
    expect(await learned.get('kormo')).toBe('কর্ম');
    learned.invalidate();
    expect(await learned.get('kormo')).toBeUndefined();
  });

  it('serializes concurrent writes', async () => {
    await Promise.all([learned.set('a', '1'), learned.set('b', '2'), learned.set('c', '3')]);
    expect(storage.entries).toEqual([
      ['a', '1'],
      ['b', '2'],
      ['c', '3'],
    ]);
  });

  it('does not write when nothing changed', async () => {
    await learned.forget('nothing');
    expect(storage.saves).toBe(0);
  });
});

describe('suggestion service with learned choices', () => {
  const tables = readAvroDict();
  let storage: MemoryStorage;
  let remember: boolean;
  let service: ReturnType<typeof createSuggestService>;
  beforeEach(() => {
    storage = new MemoryStorage();
    remember = true;
    service = createSuggestService(async (n) => tables[n] ?? [], {
      learned: new LearnedChoices(storage),
      remember: async () => remember,
    });
  });

  it('prefers a learned word next time', async () => {
    expect((await service.suggest('kormo'))?.preferred).toBeUndefined();
    await service.learn('kormo', 'কর্ম');
    const r = await service.suggest('kormo');
    expect(r?.preferred).toBe('কর্ম');
    expect(r?.words[0]).toBe('করম'); // the Ridmik output stays first
  });

  it('learns the English word too', async () => {
    await service.learn('kormo', 'kormo');
    expect((await service.suggest('kormo'))?.preferred).toBe('kormo');
  });

  it('picking the Ridmik output again forgets the choice', async () => {
    await service.learn('kormo', 'কর্ম');
    await service.learn('kormo', 'করম');
    expect((await service.suggest('kormo'))?.preferred).toBeUndefined();
    expect(storage.entries).toEqual([]);
  });

  it('ignores words that were never offered', async () => {
    await service.learn('kormo', 'ধর্ম');
    await service.learn('kormo', '<script>');
    expect(storage.entries).toEqual([]);
  });

  it('learning a suffixed word also teaches its base word', async () => {
    await service.learn('kormoke', 'কর্মকে');
    expect(storage.entries).toContainEqual(['kormoke', 'কর্মকে']);
    expect(storage.entries).toContainEqual(['kormo', 'কর্ম']);
  });

  it('picking the default for a suffixed word learns nothing', async () => {
    await service.learn('amader', 'আমাদের'); // already the Ridmik output
    expect(storage.entries).toEqual([]);
  });

  it('a remembered base word carries over to suffixed forms', async () => {
    await service.learn('kormo', 'কর্ম');
    const r = await service.suggest('kormoke');
    expect(r?.preferred).toBe('কর্মকে');
    expect(r?.words).toContain('কর্মকে');
  });

  it('does nothing when "Remember my choices" is off', async () => {
    await service.learn('kormo', 'কর্ম');
    remember = false;
    await service.learn('dhormo', 'ধর্ম');
    expect((await service.suggest('kormo'))?.preferred).toBeUndefined();
    expect(storage.entries).toEqual([['kormo', 'কর্ম']]);
  });
});
