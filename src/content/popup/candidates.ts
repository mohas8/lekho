/**
 * Candidate list state and key decisions for the suggestion popup. Pure, so
 * every rule can be unit-tested.
 */
import { classifyKey } from '../keys';
import { classOf } from '../../engine/transliterate';
import type { CompositionKind } from '../composer';

export interface CandidateState {
  /** English letters the list was built for. */
  readonly roman: string;
  /** Bangla candidates (words[0] = Ridmik output), then the English word itself. */
  readonly words: readonly string[];
  readonly selected: number;
  /** The default selection; moving away from it makes Enter pick instead of adding a newline. */
  readonly initial: number;
  /** Whether the dictionary answered (false: only the instant Ridmik output is shown). */
  readonly complete: boolean;
}

/** Builds the list shown to the user: Bangla candidates, then the English word (to keep it as typed). */
export function createState(roman: string, bangla: readonly string[], opts: { preselect?: number; complete?: boolean } = {}): CandidateState {
  const words = [...new Set([...bangla.filter((w) => w !== ''), roman])];
  const preselect = opts.preselect ?? 0;
  const initial = preselect >= 0 && preselect < words.length ? preselect : 0;
  return { roman, words, selected: initial, initial, complete: opts.complete ?? true };
}

/**
 * Replaces the list when the dictionary answers, keeping a choice the user
 * already made by arrow keys (matched by word).
 */
export function mergeState(prev: CandidateState | null, next: CandidateState): CandidateState {
  if (!prev || prev.roman !== next.roman || prev.selected === prev.initial) return next;
  const word = prev.words[prev.selected];
  const i = word === undefined ? -1 : next.words.indexOf(word);
  return i >= 0 ? { ...next, selected: i } : next;
}

export function move(state: CandidateState, delta: number): CandidateState {
  const n = state.words.length;
  if (n === 0) return state;
  return { ...state, selected: (((state.selected + delta) % n) + n) % n };
}

export function select(state: CandidateState, index: number): CandidateState {
  return index >= 0 && index < state.words.length ? { ...state, selected: index } : state;
}

export function selectedWord(state: CandidateState): string {
  return state.words[state.selected] ?? state.words[0] ?? '';
}

export type PopupDecision =
  /** Move the highlight; the key is consumed. */
  | { readonly type: 'move'; readonly delta: number }
  /** Close the list and finish the word as shown; the key is consumed. */
  | { readonly type: 'close' }
  /** Put the highlighted candidate in the page; consume the key or let it do its normal job. */
  | { readonly type: 'accept'; readonly consume: boolean }
  /** Not a list key: normal typing rules apply. */
  | { readonly type: 'pass' };

type KeyLike = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'altKey' | 'metaKey' | 'shiftKey' | 'isComposing' | 'keyCode'>;

export function decideKey(e: KeyLike, state: CandidateState, kind: CompositionKind): PopupDecision {
  if (e.isComposing) return { type: 'pass' };
  const plain = !e.ctrlKey && !e.altKey && !e.metaKey;

  if (plain && !e.shiftKey && e.key === 'ArrowDown') return { type: 'move', delta: 1 };
  if (plain && !e.shiftKey && e.key === 'ArrowUp') return { type: 'move', delta: -1 };
  if (plain && e.key === 'Escape') return { type: 'close' };
  // Enter picks only if the user moved the highlight; otherwise it keeps its
  // normal job (new line, send message), after the default candidate is applied.
  if (plain && e.key === 'Enter') return { type: 'accept', consume: state.selected !== state.initial };
  if (plain && e.key === 'Tab') return { type: 'accept', consume: false };

  const action = classifyKey(e);
  if (action.type === 'char') {
    const cls = classOf(action.ch);
    const continues = (kind === 'letters' && cls === 'letters') || (kind === 'numeric' && cls === 'numeric');
    // Space, punctuation, digits after letters: the word ends with the highlighted candidate.
    return continues ? { type: 'pass' } : { type: 'accept', consume: false };
  }
  return { type: 'pass' };
}
