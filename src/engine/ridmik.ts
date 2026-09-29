/*
 * Ridmik-style English-to-Bangla phonetic engine.
 *
 * Ported from Ridmik Parser (JavaScript implementation), ridmikparser.js
 * Copyright (c) 2012, Shamim Hasnath. All rights reserved.
 * Licensed under the BSD 3-Clause License; see THIRD_PARTY_NOTICES.md.
 *
 * For any run of ASCII letters the output is identical to the original parser
 * (verified by test/unit/ridmik-parity.test.ts against the unmodified original).
 *
 * Deliberate differences, all outside letter runs (see docs/ridmik-parser-fixes.md):
 *  1. Digits are never dropped. The original accepts 0-9 but appends nothing.
 *  2. A digit no longer leaves the parser mid-word: the original treats "2a"
 *     as a vowel sign (া) with the digit lost. Here letter runs are converted
 *     independently, so "2a" becomes "2" + "আ".
 *  3. Every non-letter resets all parser state. The original resets only
 *     `carry` and leaves `secondCarry`, `thirdCarry` and the conjunct flags
 *     from the previous word in place. No space-separated input has been found
 *     where this changes the output (200,000 random samples), so words
 *     separated by spaces still match the original exactly.
 */
import { CHAR, DJKT, DJKTT, JKT, KAR } from './map';

/**
 * "No previous letter". The original uses the number 0; for letter-only input
 * the string "0" behaves identically in every comparison, lookup-key
 * concatenation ("0" + "a" === 0 + "a") and isVowel/isConsonant check.
 */
const NONE = '0';

const VOWELS = 'AEIOUaeiou';
const HASANTA = '\u09CD';

function isVowel(c: string): boolean {
  return VOWELS.indexOf(c) !== -1;
}

function isConsonant(c: string): boolean {
  return !isVowel(c) && Number.isNaN(Number(c));
}

function inString(needle: string, haystack: string): boolean {
  return haystack.indexOf(needle) !== -1;
}

function char(key: string): string {
  return CHAR[key] ?? '';
}

function kar(key: string): string {
  return KAR[key] ?? '';
}

/** Mirrors the original StringBuilder, including its JS `slice` semantics for negative indexes. */
class Builder {
  text = '';
  append(s: string): this {
    this.text += s;
    return this;
  }
  removeFrom(from: number): this {
    this.text = this.text.slice(0, from);
    return this;
  }
  get length(): number {
    return this.text.length;
  }
}

function dualSitsUnder(thirdCarry: string, secondCarry: string, carry: string, now: string): boolean {
  if (secondCarry === 'r' && thirdCarry === 'r') return true;
  if (secondCarry === 'r') return false;

  const djkt = DJKT[carry + now];
  if (djkt !== undefined && inString(secondCarry, djkt)) return true;

  const djktt = DJKTT[carry + now];
  if (djktt !== undefined) return inString(thirdCarry + secondCarry, djktt);

  return false;
}

function notJukta(_thirdCarry: string, secondCarry: string, carry: string, now: string): boolean {
  if (now === 'r' || now === 'z' || now === 'w') return false;

  const dual = JKT[secondCarry + carry];
  if (dual !== undefined) return !inString(now, dual);

  const single = JKT[carry];
  if (single !== undefined) return !inString(now, single);

  return true;
}

/** Converts one run of ASCII letters ([A-Za-z]+). Other characters must be split off by the caller. */
export function convertLetters(engWord: string): string {
  const st = new Builder();
  let carry = NONE;
  let secondCarry = NONE;
  let thirdCarry = NONE;
  let jukta = false;
  let prevJukta = false;

  for (const original of engWord) {
    let now = original;

    if ('ABCEFPX'.includes(now) || 'KLMVYWQ'.includes(now)) now = now.toLowerCase();

    // khondo-to: "TH" keeps its capital H
    if (now === 'H' && carry !== 'T') now = 'h';

    // 'w' is 'O' at the start of a word or after a vowel
    if ((carry === NONE || isVowel(carry)) && now === 'w') now = 'O';

    if (isVowel(now)) {
      // ঋ and its vowel sign ৃ: "rri"
      if (carry === 'r' && secondCarry === 'r' && now === 'i') {
        if (thirdCarry === NONE) {
          st.removeFrom(st.length - 2);
          st.append('\u098B');
        } else {
          st.removeFrom(st.length - 3);
          st.append('\u09C3');
        }
        carry = 'i';
        continue;
      }

      const dual = secondCarry !== NONE ? KAR[carry + now] : CHAR[carry + now];

      if (dual !== undefined) {
        if (carry !== 'o') st.removeFrom(st.length - 1);
        if (isVowel(secondCarry)) {
          // a two-letter vowel sign is not applied after a vowel
          st.append(char(carry)).append(char(now));
        } else {
          st.append(dual);
        }
      } else if (now === 'o' && carry !== NONE) {
        if (isVowel(carry)) {
          st.append(char('O'));
        } else {
          thirdCarry = secondCarry;
          secondCarry = carry;
          carry = now;
          continue;
        }
      } else if (isVowel(carry) || carry === NONE) {
        if (now === 'a' && carry !== NONE) st.append(char('y')).append(kar('a'));
        else st.append(char(now));
      } else {
        st.append(kar(now));
      }
    }

    if (now === 'y' || now === 'Z' || now === 'r') jukta = false;

    // After a conjunct, if the last two letters don't form a two-letter
    // consonant, the new letter starts fresh.
    const tempNoCarry = jukta && CHAR[carry + now] === undefined;

    if (isConsonant(now) && isConsonant(carry) && !tempNoCarry) {
      // jo-fola
      if (now === 'y' || now === 'Z') {
        if (!(now === 'y' && carry === 'q' && secondCarry === 'q')) now = 'z';
      }

      // "gg" as in gyan (জ্ঞ); not after n/N, to keep ং/ঙ
      if (carry === 'g' && now === 'g' && secondCarry !== 'N' && secondCarry !== 'n') {
        st.removeFrom(st.length - 1);
        st.append('\u099C\u09CD\u099E');
        prevJukta = jukta;
        jukta = true;
        secondCarry = 'g';
        continue;
      }

      // "kkh" = kSh (ক্ষ)
      if (secondCarry === 'k' && carry === 'k' && now === 'h') carry = 'S';

      const dual = CHAR[carry + now];

      if (dual !== undefined) {
        // kaNgkShito
        if (thirdCarry === 'g' && secondCarry === 'k' && carry === 'S' && now === 'h') {
          prevJukta = false;
          jukta = false;
        }

        const firstOrAfterVowelOrJukta = isVowel(secondCarry) || secondCarry === NONE || prevJukta;

        if (dualSitsUnder(thirdCarry, secondCarry, carry, now) && !firstOrAfterVowelOrJukta) {
          st.removeFrom(st.length - 1);
          if (secondCarry === 'r' && thirdCarry === 'r') st.removeFrom(st.length - 1);
          if (!jukta && secondCarry !== NONE && !isVowel(secondCarry)) st.append(HASANTA);
          st.append(dual);
          prevJukta = jukta;
          // stays true so three-letter conjuncts can form
          jukta = true;
        } else {
          if (jukta) st.removeFrom(st.length - 2);
          else st.removeFrom(st.length - 1);

          if (secondCarry === 'g' && carry === 'g' && now === 'h') {
            // "ggh": undo the জ্ঞ produced for "gg"
            st.removeFrom(st.length - 1);
            st.append(char('g'));
          }

          st.append(dual);
          prevJukta = jukta;
          jukta = false;
        }
      } else {
        prevJukta = jukta;
        jukta = false;

        if (secondCarry !== 'r' && carry === 'r' && now === 'z') {
          // র‍্য as in র‍্যাব: ZWJ + hasanta
          st.append('\u200D' + HASANTA);
        } else if (carry === 'r' && secondCarry !== 'r') {
          // (c) r (c): no reph
        } else if (carry === 'r' && secondCarry === 'r' && isConsonant(thirdCarry)) {
          // (c) rr (c): no reph
        } else if (carry === 'r' && secondCarry === 'r' && (isVowel(thirdCarry) || thirdCarry === NONE)) {
          // (v) rr (c): reph
          st.removeFrom(st.length - 1);
          st.append(HASANTA);
        } else if (notJukta(thirdCarry, secondCarry, carry, now)) {
          // not a conjunct
        } else {
          st.append(HASANTA);
          jukta = true;
        }

        st.append(char(now));
      }
    } else if (isConsonant(now)) {
      if (isVowel(carry) && now === 'Z') st.append(HASANTA);
      if (carry === NONE && now === 'x') st.append(char('e'));

      prevJukta = jukta;
      jukta = false;

      // bo-fola
      if (now === 'w' && isConsonant(carry) && isConsonant(secondCarry)) {
        st.append(HASANTA);
        prevJukta = jukta;
        jukta = true;
      }
      // lakshmi / lokhnou
      if (thirdCarry === 'k' && secondCarry === 'S' && carry === 'h' && (now === 'N' || now === 'm')) {
        st.append(HASANTA);
        prevJukta = false;
        jukta = true;
      }
      st.append(char(now));
    }

    thirdCarry = secondCarry;
    secondCarry = carry;
    carry = now;
  }

  return st.text;
}

const LETTER_RUN = /[A-Za-z]+/g;

/**
 * Converts every letter run in `text` with the Ridmik rules and leaves all
 * other characters unchanged (no digit or punctuation mapping; see transliterate).
 */
export function ridmikToBangla(text: string): string {
  return text.replace(LETTER_RUN, (run) => convertLetters(run));
}
