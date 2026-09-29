import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { convertLetters, ridmikToBangla } from '../../src/engine/ridmik';
import { loadReferenceParser } from '../reference/load';

const reference = loadReferenceParser();

const letters = fc.string({
  unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'),
  minLength: 1,
  maxLength: 15,
});

// Letters Ridmik users actually combine, weighted towards consonant clusters,
// so conjunct/reph/khondo-to paths get exercised far more than uniform noise.
const ridmikish = fc
  .array(
    fc.constantFrom(
      ...'aeiouAEIOUkgcjTDtdnpbmrlshSNRyYzZwqxfvKGCJHBVM'.split(''),
      'rr', 'TH', 'qq', 'cb', 'hs', 'nj', 'nc', 'kkh', 'kSh', 'gg', 'ng', 'Ng', 'NG', 'OI', 'OU', 'oo', 'rri',
    ),
    { minLength: 1, maxLength: 8 },
  )
  .map((parts) => parts.join('').slice(0, 15));

describe('Ridmik engine: golden cases', () => {
  const cases: Array<[string, string]> = [
    ['korrmo', 'কর্ম'],
    ['kormo', 'করম'],
    ['TH', 'ৎ'],
    ['qq', 'ঁ'],
    ['cb', 'ঁ'],
    ['hs', '্'],
    ['ry', 'র\u200D্য'],
    ['rZ', 'র\u200D্য'],
    ['gonj', 'গঞ্জ'],
    ['gonc', 'গঞ্চ'],
    ['ami', 'আমি'],
    ['bangladesh', 'বাংলাদেশ'],
    ['amader', 'আমাদের'],
    ['rri', 'ঋ'],
    ['krri', 'কৃ'],
    ['kkh', 'ক্ষ'],
    ['kShoma', 'ক্ষমা'],
    ['gg', 'জ্ঞ'],
    ['OI', 'ঐ'],
    ['OU', 'ঔ'],
    ['w', 'ও'],
    ['kw', 'ক্ব'],
  ];
  it.each(cases)('%s -> %s', (input, expected) => {
    expect(convertLetters(input)).toBe(expected);
  });

  it('converts a sentence word by word', () => {
    expect(ridmikToBangla('amar sOnar bangla')).toBe('আমার সোনার বাংলা');
    expect(ridmikToBangla('ami korrmo kori')).toBe('আমি কর্ম করি');
  });

  it('returns an empty string for empty input', () => {
    expect(convertLetters('')).toBe('');
  });
});

describe('Ridmik engine: parity with the original parser', () => {
  it('matches the reference on 10,000 random letter strings', () => {
    fc.assert(
      fc.property(letters, (s) => convertLetters(s) === reference(s)),
      { numRuns: 10_000, seed: 20260929 },
    );
  });

  it('matches the reference on 10,000 Ridmik-style letter strings', () => {
    fc.assert(
      fc.property(ridmikish, (s) => convertLetters(s) === reference(s)),
      { numRuns: 10_000, seed: 29092026 },
    );
  });

  it('never emits "undefined" or non-Bangla characters for letters', () => {
    fc.assert(
      fc.property(letters, (s) => /^[\u0980-\u09FF\u200D]*$/.test(convertLetters(s))),
      { numRuns: 5_000, seed: 7 },
    );
  });

  it('matches the reference for space-separated words', () => {
    const words = fc.array(letters, { minLength: 1, maxLength: 5 });
    fc.assert(
      fc.property(words, (ws) => ridmikToBangla(ws.join(' ')) === reference(ws.join(' '))),
      { numRuns: 2_000, seed: 11 },
    );
  });
});

describe('Ridmik engine: documented fixes', () => {
  it('keeps digits the original drops', () => {
    expect(reference('2a')).toBe('া'); // original: digit lost, stray vowel sign
    expect(ridmikToBangla('2a')).toBe('2আ');
    expect(ridmikToBangla('a2')).toBe('আ2');
  });

  it('passes non-letters through unchanged', () => {
    expect(ridmikToBangla('ami, tumi!')).toBe('আমি, তুমি!');
    expect(ridmikToBangla('')).toBe('');
  });
});
