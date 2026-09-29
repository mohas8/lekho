/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Port of avroregexlib.js from ibus-avro (https://github.com/sarim/ibus-avro).
 * The Original Code is jsAvroPhonetic.
 * Initial Developers: Mehdi Hasan Khan <mhasan@omicronlab.com>, Rifat Nabi <to.rifat@gmail.com>
 * Copyright (C) OmicronLab (http://www.omicronlab.com). All Rights Reserved.
 *
 * Changes from the original:
 *  - TypeScript; the pattern table lives in data/regexData.ts.
 *  - Emits Bangla characters directly instead of \u escapes.
 *  - Characters in the Unicode Private Use Area are passed through untouched
 *    (not lower-cased, not treated as letters) so a caller can splice its own
 *    fragments into the result; see ridmikRegex.ts.
 */

export interface RegexMatch {
  readonly type: string; // "prefix" | "suffix"
  readonly scope: string; // "punctuation" | "vowel" | "consonant" | "exact"
  readonly value: string;
  readonly negative: boolean;
}

export interface RegexRule {
  readonly matches: readonly RegexMatch[];
  readonly replace: string;
}

export interface RegexPattern {
  readonly find: string;
  readonly replace: string;
  readonly rules: readonly RegexRule[];
}

export interface RegexData {
  readonly patterns: readonly RegexPattern[];
  readonly vowel: string;
  readonly consonant: string;
  readonly ignore: string;
}

/** Appended after every matched pattern: optional ya/ba/ma-fola, hasanta, visarga or chandrabindu. */
export const PATTERN_TAIL = '(্[যবম])?(্?)([ঃঁ]?)';

export class AvroRegex {
  constructor(private readonly data: RegexData) {}

  /** Builds a regular-expression source (without anchors) matching Bangla spellings of `input`. */
  parse(input: string): string {
    const fixed = this.fixString(input);
    let output = '';
    for (let cur = 0; cur < fixed.length; ++cur) {
      const start = cur;
      let matched = false;

      for (const pattern of this.data.patterns) {
        const end = cur + pattern.find.length;
        if (end > fixed.length || fixed.substring(start, end) !== pattern.find) continue;

        const prev = start - 1;
        for (const rule of pattern.rules) {
          if (this.ruleApplies(rule, fixed, start, end, prev)) {
            output += rule.replace + PATTERN_TAIL;
            cur = end - 1;
            matched = true;
            break;
          }
        }
        if (matched) break;

        output += pattern.replace + PATTERN_TAIL;
        cur = end - 1;
        matched = true;
        break;
      }

      if (!matched) output += fixed.charAt(cur);
    }
    return output;
  }

  private ruleApplies(rule: RegexRule, fixed: string, start: number, end: number, prev: number): boolean {
    for (const match of rule.matches) {
      const chk = match.type === 'suffix' ? end : prev;
      let ok: boolean;
      if (match.scope === 'punctuation') {
        ok =
          (chk < 0 && match.type === 'prefix') ||
          (chk >= fixed.length && match.type === 'suffix') ||
          this.isPunctuation(fixed.charAt(chk));
      } else if (match.scope === 'vowel') {
        ok =
          ((chk >= 0 && match.type === 'prefix') || (chk < fixed.length && match.type === 'suffix')) &&
          this.isVowel(fixed.charAt(chk));
      } else if (match.scope === 'consonant') {
        ok =
          ((chk >= 0 && match.type === 'prefix') || (chk < fixed.length && match.type === 'suffix')) &&
          this.isConsonant(fixed.charAt(chk));
      } else if (match.scope === 'exact') {
        const [s, e] = match.type === 'suffix' ? [end, end + match.value.length] : [start - match.value.length, start];
        // Upstream checks `end < length` (not <=) here; kept as is.
        ok = s >= 0 && e < fixed.length && fixed.substring(s, e) === match.value;
      } else {
        ok = true;
      }
      if (ok === match.negative) return false;
    }
    return true;
  }

  private fixString(input: string): string {
    let fixed = '';
    for (const c of input) {
      if (isPrivateUse(c)) fixed += c;
      else if (!this.isIgnore(c)) fixed += c.toLowerCase();
    }
    return fixed;
  }

  private isVowel(c: string): boolean {
    return c !== '' && this.data.vowel.includes(c.toLowerCase());
  }

  private isConsonant(c: string): boolean {
    return c !== '' && this.data.consonant.includes(c.toLowerCase());
  }

  private isPunctuation(c: string): boolean {
    return !(this.isVowel(c) || this.isConsonant(c));
  }

  private isIgnore(c: string): boolean {
    return this.data.ignore.includes(c.toLowerCase());
  }
}

export function isPrivateUse(c: string): boolean {
  const code = c.codePointAt(0) ?? 0;
  return code >= 0xe000 && code <= 0xf8ff;
}
