import { describe, expect, it } from 'vitest';
import { Composer, type Step } from '../../src/content/composer';

const ON = { banglaDigits: true, dotToDari: true };
const OFF = { banglaDigits: false, dotToDari: false };

/** Plays keys through a composer against a simulated field and returns its text. */
function play(keys: string[], options = ON): { text: string; composer: Composer; commits: string[] } {
  const composer = new Composer(options);
  let text = '';
  const commits: string[] = [];
  const apply = (steps: readonly Step[]) => {
    for (const s of steps) {
      if (s.type === 'commit') commits.push(`${s.composition.roman}=${s.composition.rendered}`);
      else {
        expect(text.endsWith(s.before)).toBe(true);
        text = text.slice(0, text.length - s.before.length) + s.after;
      }
    }
  };
  for (const k of keys) {
    const r = k === '<BS>' ? composer.backspace() : composer.type(k);
    apply(r.steps);
    if (!r.handled) {
      if (k === '<BS>') text = text.slice(0, -1);
      else text += k;
    }
  }
  return { text, composer, commits };
}

const chars = (s: string) => [...s];

describe('Composer', () => {
  it('re-converts the whole word on every letter', () => {
    const c = new Composer(ON);
    expect(c.type('k').steps).toEqual([{ type: 'replace', before: '', after: 'ক' }]);
    expect(c.type('o').steps).toEqual([{ type: 'replace', before: 'ক', after: 'ক' }]);
    expect(c.type('r').steps).toEqual([{ type: 'replace', before: 'ক', after: 'কর' }]);
    expect(c.type('r').steps).toEqual([{ type: 'replace', before: 'কর', after: 'করর' }]);
    expect(c.type('m').steps).toEqual([{ type: 'replace', before: 'করর', after: 'কর্ম' }]);
    expect(c.composition).toEqual({ kind: 'letters', roman: 'korrm', rendered: 'কর্ম' });
  });

  it('types a sentence; space commits and passes through', () => {
    const { text, commits } = play(chars('ami korrmo kori'));
    expect(text).toBe('আমি কর্ম করি');
    expect(commits).toEqual(['ami=আমি', 'korrmo=কর্ম']);
  });

  it('backspace removes the last English letter and re-converts', () => {
    expect(play([...chars('bangla'), '<BS>', '<BS>', ...chars('ladesh')]).text).toBe('বাংলাদেশ');
    expect(play([...chars('korrm'), '<BS>']).text).toBe('করর');
  });

  it('backspace on the last letter removes the word and ends composition', () => {
    const { text, composer } = play(['k', '<BS>']);
    expect(text).toBe('');
    expect(composer.active).toBe(false);
  });

  it('backspace with no word passes through', () => {
    const c = new Composer(ON);
    expect(c.backspace()).toEqual({ steps: [], handled: false });
    expect(play([...chars('ami '), '<BS>']).text).toBe('আমি');
  });

  it('composes digits and dots with the settings', () => {
    expect(play(chars('2026.')).text).toBe('২০২৬।');
    expect(play(chars('10.5')).text).toBe('১০.৫');
    expect(play(chars('ki...')).text).toBe('কি...');
  });

  it('switching between letters and digits commits the previous part', () => {
    const { text, commits } = play(chars('a2b'));
    expect(text).toBe('আ২ব');
    expect(commits).toEqual(['a=আ', '2=২']);
  });

  it('passes digits and dots through when both settings are off', () => {
    const { text, commits } = play(chars('ami 2026.'), OFF);
    expect(text).toBe('আমি 2026.');
    expect(commits).toEqual(['ami=আমি']);
  });

  it('commit ends the word; the next letter starts a new one', () => {
    const c = new Composer(ON);
    c.type('a');
    expect(c.commit()).toEqual([{ type: 'commit', composition: { kind: 'letters', roman: 'a', rendered: 'আ' } }]);
    expect(c.commit()).toEqual([]);
    expect(c.type('k').steps).toEqual([{ type: 'replace', before: '', after: 'ক' }]);
  });

  it('reset forgets the word without a commit', () => {
    const c = new Composer(ON);
    c.type('a');
    c.reset();
    expect(c.active).toBe(false);
    expect(c.commit()).toEqual([]);
  });

  it('substitute swaps the page text but keeps the roman buffer', () => {
    const c = new Composer(ON);
    c.type('k');
    c.type('o');
    c.type('r');
    c.type('m');
    c.type('o');
    expect(c.substitute('কর্ম')).toEqual({ type: 'replace', before: 'করম', after: 'কর্ম' });
    expect(c.substitute('কর্ম')).toBeNull();
    expect(c.composition).toEqual({ kind: 'letters', roman: 'kormo', rendered: 'কর্ম' });
    // Typing continues from the roman buffer.
    expect(c.type('k').steps).toEqual([{ type: 'replace', before: 'কর্ম', after: 'করমক' }]);
  });

  it('non-ASCII characters commit and pass through', () => {
    expect(play(chars('amiআ')).text).toBe('আমিআ');
  });
});
