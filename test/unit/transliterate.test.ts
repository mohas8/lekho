import { describe, expect, it } from 'vitest';
import { renderNumeric, transliterate } from '../../src/engine/transliterate';

const ON = { banglaDigits: true, dotToDari: true };
const OFF = { banglaDigits: false, dotToDari: false };

describe('transliterate', () => {
  it('uses Bangla digits and dari by default', () => {
    expect(transliterate('ami 2026 sale jonmechi.')).toBe('আমি ২০২৬ সালে জন্মেছি।');
  });

  it('keeps ASCII digits and "." when both settings are off', () => {
    expect(transliterate('ami 2026 sale.', OFF)).toBe('আমি 2026 সালে.');
  });

  it('applies the settings independently', () => {
    expect(transliterate('3.', { banglaDigits: true, dotToDari: false })).toBe('৩.');
    expect(transliterate('3.', { banglaDigits: false, dotToDari: true })).toBe('3।');
  });

  it('keeps decimal points and ellipses', () => {
    expect(transliterate('10.5', ON)).toBe('১০.৫');
    expect(transliterate('ki...', ON)).toBe('কি...');
    expect(transliterate('Ok..', ON)).toBe('ওক..');
  });

  it('passes other punctuation and non-ASCII through', () => {
    expect(transliterate('ami, tumi? (O) — আমি', ON)).toBe('আমি, তুমি? (ও) — আমি');
  });
});

describe('renderNumeric', () => {
  it.each([
    ['.', '।'],
    ['..', '..'],
    ['20.', '২০।'],
    ['20.5', '২০.৫'],
    ['20.5.', '২০.৫।'],
    ['0123456789', '০১২৩৪৫৬৭৮৯'],
  ])('%s -> %s', (input, expected) => {
    expect(renderNumeric(input, ON)).toBe(expected);
  });
});
