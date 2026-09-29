/**
 * Composer: a pure state machine for the word currently being typed.
 *
 * It keeps the English characters of the current word (the roman buffer) and
 * what has been written into the page for it. Each keystroke re-converts the
 * whole buffer, so Ridmik rules that change earlier letters (conjuncts, reph)
 * apply live. The caller applies the returned steps to the page.
 *
 * Two kinds of composition exist:
 *  - letters: [A-Za-z]+ converted with the Ridmik engine
 *  - numeric: [0-9.]+ rendered with the digit / dari settings, so "10." shows
 *    "১০।" and turns into "১০.৫" when a digit follows
 */
import { convertLetters } from '../engine/ridmik';
import { classOf, renderNumeric, type TransliterateOptions } from '../engine/transliterate';

export type CompositionKind = 'letters' | 'numeric';

export interface Composition {
  readonly kind: CompositionKind;
  /** English characters typed for this word, e.g. "korrmo". */
  readonly roman: string;
  /** Text currently written into the page for this word, e.g. "কর্ম". */
  readonly rendered: string;
}

export type Step =
  /** Replace `before` (the text just before the caret, written by us) with `after`. `before` is "" for a new word. */
  | { readonly type: 'replace'; readonly before: string; readonly after: string }
  /** The word is finished; its text is already in the page. */
  | { readonly type: 'commit'; readonly composition: Composition };

export interface ComposeResult {
  readonly steps: readonly Step[];
  /** true: the key was turned into Bangla and its default action must be suppressed. */
  readonly handled: boolean;
}

export class Composer {
  private current: Composition | null = null;

  constructor(private options: TransliterateOptions) {}

  get active(): boolean {
    return this.current !== null;
  }

  get composition(): Composition | null {
    return this.current;
  }

  setOptions(options: TransliterateOptions): void {
    this.options = options;
  }

  /** Whether digits and "." are converted at all with the current settings. */
  private composesNumeric(): boolean {
    return this.options.banglaDigits || this.options.dotToDari;
  }

  private render(kind: CompositionKind, roman: string): string {
    return kind === 'letters' ? convertLetters(roman) : renderNumeric(roman, this.options);
  }

  /** Handles one printable character. */
  type(ch: string): ComposeResult {
    const cls = classOf(ch);
    const kind: CompositionKind | null =
      cls === 'letters' ? 'letters' : cls === 'numeric' && this.composesNumeric() ? 'numeric' : null;

    if (kind === null) {
      // Space, punctuation, other scripts: finish the word, let the key through.
      return { steps: this.commit(), handled: false };
    }

    const steps: Step[] = [];
    if (this.current && this.current.kind !== kind) steps.push(...this.commit());

    const before = this.current?.rendered ?? '';
    const roman = (this.current?.roman ?? '') + ch;
    const rendered = this.render(kind, roman);
    this.current = { kind, roman, rendered };
    steps.push({ type: 'replace', before, after: rendered });
    return { steps, handled: true };
  }

  /** Removes the last English character of the word and re-converts it. */
  backspace(): ComposeResult {
    const cur = this.current;
    if (!cur) return { steps: [], handled: false };

    const roman = cur.roman.slice(0, -1);
    if (roman === '') {
      this.current = null;
      return { steps: [{ type: 'replace', before: cur.rendered, after: '' }], handled: true };
    }
    const rendered = this.render(cur.kind, roman);
    this.current = { kind: cur.kind, roman, rendered };
    return { steps: [{ type: 'replace', before: cur.rendered, after: rendered }], handled: true };
  }

  /** Finishes the current word, if any. */
  commit(): Step[] {
    const cur = this.current;
    this.current = null;
    return cur ? [{ type: 'commit', composition: cur }] : [];
  }

  /**
   * Replaces what the page shows for the current word (e.g. a suggestion was
   * chosen) and returns the step to apply. The roman buffer is unchanged.
   */
  substitute(text: string): Step | null {
    const cur = this.current;
    if (!cur || cur.rendered === text) return null;
    this.current = { ...cur, rendered: text };
    return { type: 'replace', before: cur.rendered, after: text };
  }

  /** Forgets the current word without a commit (the page text changed underneath us). */
  reset(): void {
    this.current = null;
  }
}
