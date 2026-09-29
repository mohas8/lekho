import { describe, expect, it } from 'vitest';
import { SuggestClient } from '../../src/content/suggestClient';
import { createState, decideKey, mergeState, move, select, selectedWord } from '../../src/content/popup/candidates';
import { isToWorker, MSG, type SuggestReply, type SuggestRequest } from '../../src/shared/messages';
import { createSuggestService } from '../../src/sw/suggestService';
import { readAvroDict } from '../../scripts/build-dict';

/** A send function whose replies the test releases by hand, in any order. */
function manualSend() {
  const pending: Array<{ msg: SuggestRequest; resolve: (r: SuggestReply | undefined) => void; reject: (e: unknown) => void }> = [];
  const send = (msg: SuggestRequest) =>
    new Promise<SuggestReply | undefined>((resolve, reject) => pending.push({ msg, resolve, reject }));
  const answer = (i: number, words: string[] = ['x']) => {
    const p = pending[i]!;
    p.resolve({ id: p.msg.id, roman: p.msg.roman, words });
  };
  return { send, pending, answer };
}

describe('SuggestClient', () => {
  it('delivers only the reply to the latest request', async () => {
    const m = manualSend();
    const client = new SuggestClient(m.send);
    const first = client.request('k');
    const second = client.request('ko');
    m.answer(1, ['ক']);
    m.answer(0, ['old']);
    expect(await second).toEqual({ id: 2, roman: 'ko', words: ['ক'] });
    expect(await first).toBeNull();
  });

  it('drops replies after cancel()', async () => {
    const m = manualSend();
    const client = new SuggestClient(m.send);
    const r = client.request('k');
    client.cancel();
    m.answer(0);
    expect(await r).toBeNull();
  });

  it('returns null when the worker is unavailable or replies with the wrong id/word', async () => {
    expect(await new SuggestClient(() => Promise.reject(new Error('gone'))).request('k')).toBeNull();
    expect(await new SuggestClient(async () => undefined).request('k')).toBeNull();
    expect(await new SuggestClient(async (m) => ({ id: m.id + 1, roman: m.roman, words: [] })).request('k')).toBeNull();
    expect(await new SuggestClient(async (m) => ({ id: m.id, roman: 'other', words: [] })).request('k')).toBeNull();
  });

  it('sends well-formed requests', async () => {
    const m = manualSend();
    void new SuggestClient(m.send).request('kormo');
    expect(m.pending[0]!.msg).toEqual({ type: MSG.suggest, id: 1, roman: 'kormo' });
    expect(isToWorker(m.pending[0]!.msg)).toBe(true);
  });
});

describe('message validation', () => {
  it('accepts only [A-Za-z]{1,40} words with integer ids', () => {
    expect(isToWorker({ type: MSG.suggest, id: 1, roman: 'kormo' })).toBe(true);
    expect(isToWorker({ type: MSG.suggest, id: 1, roman: '' })).toBe(false);
    expect(isToWorker({ type: MSG.suggest, id: 1, roman: 'a'.repeat(41) })).toBe(false);
    expect(isToWorker({ type: MSG.suggest, id: 1, roman: 'ami tumi' })).toBe(false);
    expect(isToWorker({ type: MSG.suggest, id: 1, roman: '<img>' })).toBe(false);
    expect(isToWorker({ type: MSG.suggest, id: '1', roman: 'a' })).toBe(false);
    expect(isToWorker({ type: 'other' })).toBe(false);
    expect(isToWorker(null)).toBe(false);
  });
});

describe('candidate list', () => {
  it('puts the Bangla candidates first and the English word last, without duplicates', () => {
    const s = createState('kormo', ['করম', 'কর্ম', 'করম']);
    expect(s.words).toEqual(['করম', 'কর্ম', 'kormo']);
    expect(s.selected).toBe(0);
    expect(selectedWord(s)).toBe('করম');
  });

  it('moves the highlight with wrap-around', () => {
    const s = createState('kormo', ['করম', 'কর্ম']);
    expect(move(s, 1).selected).toBe(1);
    expect(move(s, -1).selected).toBe(2);
    expect(move(move(move(s, 1), 1), 1).selected).toBe(0);
    expect(select(s, 1).selected).toBe(1);
    expect(select(s, 9).selected).toBe(0);
  });

  it('keeps a user choice when the dictionary answer arrives', () => {
    const instant = move(createState('kormo', ['করম'], { complete: false }), 1); // English word chosen
    const merged = mergeState(instant, createState('kormo', ['করম', 'কর্ম', 'ক্রম']));
    expect(selectedWord(merged)).toBe('kormo');
    expect(merged.complete).toBe(true);
    // Untouched highlight: take the new default.
    expect(mergeState(createState('kormo', ['করম']), createState('kormo', ['করম', 'কর্ম'])).selected).toBe(0);
  });

  it('honours a preselected candidate as the default', () => {
    const s = createState('kormo', ['করম', 'কর্ম'], { preselect: 1 });
    expect(s.selected).toBe(1);
    expect(s.initial).toBe(1);
    expect(createState('kormo', ['করম'], { preselect: 7 }).selected).toBe(0);
  });
});

describe('popup keys', () => {
  const key = (k: string, extra: Partial<KeyboardEvent> = {}) => ({
    key: k,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    shiftKey: false,
    isComposing: false,
    keyCode: 0,
    ...extra,
  });
  const state = createState('kormo', ['করম', 'কর্ম']);
  const moved = move(state, 1);

  it('arrows move, Escape closes', () => {
    expect(decideKey(key('ArrowDown'), state, 'letters')).toEqual({ type: 'move', delta: 1 });
    expect(decideKey(key('ArrowUp'), state, 'letters')).toEqual({ type: 'move', delta: -1 });
    expect(decideKey(key('Escape'), state, 'letters')).toEqual({ type: 'close' });
    expect(decideKey(key('ArrowDown', { shiftKey: true }), state, 'letters')).toEqual({ type: 'pass' });
  });

  it('Enter picks only after the highlight was moved', () => {
    expect(decideKey(key('Enter'), state, 'letters')).toEqual({ type: 'accept', consume: false });
    expect(decideKey(key('Enter'), moved, 'letters')).toEqual({ type: 'accept', consume: true });
    expect(decideKey(key('Enter', { ctrlKey: true }), moved, 'letters')).toEqual({ type: 'pass' });
  });

  it('space, punctuation, digits and Tab end the word with the highlighted candidate', () => {
    for (const k of [' ', ',', '?', '1', 'Tab']) {
      expect(decideKey(key(k), moved, 'letters'), k).toEqual({ type: 'accept', consume: false });
    }
  });

  it('letters and backspace keep typing; shortcuts and IME pass', () => {
    for (const k of ['a', 'Z', 'Backspace', 'ArrowLeft', 'Home']) expect(decideKey(key(k), moved, 'letters'), k).toEqual({ type: 'pass' });
    expect(decideKey(key('z', { ctrlKey: true }), moved, 'letters')).toEqual({ type: 'pass' });
    expect(decideKey(key('ArrowDown', { isComposing: true }), moved, 'letters')).toEqual({ type: 'pass' });
  });
});

describe('suggestion service', () => {
  const tables = readAvroDict();
  const service = createSuggestService(async (name) => tables[name] ?? []);

  it('returns ranked words with the Ridmik output first', async () => {
    const r = await service.suggest('kormo');
    expect(r?.words[0]).toBe('করম');
    expect(r?.words).toContain('কর্ম');
  });

  it('rejects anything that is not a plain English word', async () => {
    expect(await service.suggest('')).toBeNull();
    expect(await service.suggest('a b')).toBeNull();
    expect(await service.suggest('x'.repeat(41))).toBeNull();
  });
});
