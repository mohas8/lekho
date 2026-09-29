/** Messages between the service worker and the content scripts. */

export const MSG = {
  /** content -> worker: "I am loaded; should I be on?" Reply: HelloReply. */
  hello: 'lekho:hello',
  /** content -> worker: the page added or navigated an iframe; inject into new frames. */
  framesChanged: 'lekho:frames-changed',
  /** content -> worker: dictionary suggestions for a word. Reply: SuggestReply. */
  suggest: 'lekho:suggest',
  /** content -> worker: the user picked `word` for `roman` in the list. No reply. */
  learn: 'lekho:learn',
  /** content -> worker: Lekho can't type in this page's editor (e.g. Google Docs changed its input). No reply. */
  unsupported: 'lekho:unsupported',
  /** worker -> content (all frames of a tab). */
  setEnabled: 'lekho:set-enabled',
} as const;

/** Longest English word the suggestion service accepts. */
export const MAX_SUGGEST_ROMAN = 40;
/** Longest Bangla word accepted for learning. */
export const MAX_WORD = 100;

export interface HelloMessage {
  readonly type: typeof MSG.hello;
}

export interface FramesChangedMessage {
  readonly type: typeof MSG.framesChanged;
}

export interface SuggestRequest {
  readonly type: typeof MSG.suggest;
  readonly id: number;
  /** English letters of the word, [A-Za-z]{1,40}. */
  readonly roman: string;
}

export interface SuggestReply {
  readonly id: number;
  readonly roman: string;
  /** Candidates, best first; words[0] is the Ridmik output. */
  readonly words: readonly string[];
  /** A remembered earlier choice to highlight by default (a word in `words`, or `roman` itself). */
  readonly preferred?: string;
}

export interface LearnMessage {
  readonly type: typeof MSG.learn;
  readonly roman: string;
  readonly word: string;
}

export interface UnsupportedMessage {
  readonly type: typeof MSG.unsupported;
}

export interface HelloReply {
  readonly enabled: boolean;
}

export interface SetEnabledMessage {
  readonly type: typeof MSG.setEnabled;
  readonly enabled: boolean;
}

export type ToWorker = HelloMessage | FramesChangedMessage | SuggestRequest | LearnMessage | UnsupportedMessage;
export type ToContent = SetEnabledMessage;

function hasType(msg: unknown): msg is { type: unknown } {
  return typeof msg === 'object' && msg !== null && 'type' in msg;
}

export function isValidRoman(roman: unknown): roman is string {
  return typeof roman === 'string' && roman.length <= MAX_SUGGEST_ROMAN && /^[A-Za-z]+$/.test(roman);
}

export function isToWorker(msg: unknown): msg is ToWorker {
  if (!hasType(msg)) return false;
  if (msg.type === MSG.hello || msg.type === MSG.framesChanged || msg.type === MSG.unsupported) return true;
  if (msg.type === MSG.suggest) {
    const m = msg as { id?: unknown; roman?: unknown };
    return Number.isSafeInteger(m.id) && isValidRoman(m.roman);
  }
  if (msg.type === MSG.learn) {
    const m = msg as { roman?: unknown; word?: unknown };
    return isValidRoman(m.roman) && typeof m.word === 'string' && m.word.length > 0 && m.word.length <= MAX_WORD;
  }
  return false;
}

export function isToContent(msg: unknown): msg is ToContent {
  return hasType(msg) && msg.type === MSG.setEnabled && typeof (msg as { enabled?: unknown }).enabled === 'boolean';
}
