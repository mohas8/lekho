/**
 * Text-level transliteration: Ridmik rules for letter runs plus the
 * extension-level digit and full-stop settings, which the Ridmik parser
 * itself does not define.
 */
import { convertLetters } from './ridmik';

export interface TransliterateOptions {
  /** 0-9 -> ০-৯ */
  banglaDigits: boolean;
  /** "." -> "।" (dari), except between two digits and in runs of two or more dots */
  dotToDari: boolean;
}

export const DEFAULT_TRANSLITERATE_OPTIONS: Readonly<TransliterateOptions> = Object.freeze({
  banglaDigits: true,
  dotToDari: true,
});

const BANGLA_DIGITS = '০১২৩৪৫৬৭৮৯';
export const DARI = '।';

/** Letters, digit/dot runs, and everything else. */
const TOKEN = /[A-Za-z]+|[0-9.]+|[^A-Za-z0-9.]+/g;

export type TokenClass = 'letters' | 'numeric' | 'other';

export function classOf(ch: string): TokenClass {
  if (/^[A-Za-z]$/.test(ch)) return 'letters';
  if (/^[0-9.]$/.test(ch)) return 'numeric';
  return 'other';
}

function isDigit(c: string | undefined): boolean {
  return c !== undefined && c >= '0' && c <= '9';
}

/** Renders a run of digits and dots, e.g. "20.5" -> "২০.৫", "20." -> "২০।", "..." -> "...". */
export function renderNumeric(run: string, opts: TransliterateOptions): string {
  let out = '';
  for (let i = 0; i < run.length; i++) {
    const c = run[i] as string;
    if (isDigit(c)) {
      out += opts.banglaDigits ? BANGLA_DIGITS[c.charCodeAt(0) - 48] : c;
      continue;
    }
    // c === '.'
    const isRun = run[i - 1] === '.' || run[i + 1] === '.';
    const isDecimal = isDigit(run[i - 1]) && isDigit(run[i + 1]);
    out += opts.dotToDari && !isRun && !isDecimal ? DARI : '.';
  }
  return out;
}

export function transliterate(text: string, opts: TransliterateOptions = DEFAULT_TRANSLITERATE_OPTIONS): string {
  return text.replace(TOKEN, (token) => {
    const first = token[0] as string;
    if (classOf(first) === 'letters') return convertLetters(token);
    if (classOf(first) === 'numeric') return renderNumeric(token, opts);
    return token;
  });
}
