/** Maps keyboard events to composer actions. Pure; no DOM access. */

export type KeyAction =
  /** A printable character to feed to the composer. */
  | { readonly type: 'char'; readonly ch: string }
  | { readonly type: 'backspace' }
  /** Finish the word and let the key do its normal job (Enter, arrows, shortcuts, IME, ...). */
  | { readonly type: 'boundary' }
  /** Nothing to do (modifier pressed on its own). */
  | { readonly type: 'ignore' };

type KeyLike = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'altKey' | 'metaKey' | 'isComposing' | 'keyCode'>;

const MODIFIER_KEYS = new Set([
  'Shift',
  'Control',
  'Alt',
  'AltGraph',
  'Meta',
  'OS',
  'Super',
  'Hyper',
  'Fn',
  'FnLock',
  'CapsLock',
  'NumLock',
  'ScrollLock',
]);

export function classifyKey(e: KeyLike): KeyAction {
  if (MODIFIER_KEYS.has(e.key)) return { type: 'ignore' };
  // An OS input method is active: never interfere with it.
  if (e.isComposing || e.key === 'Process' || e.keyCode === 229) return { type: 'boundary' };
  // Shortcuts (Ctrl+A, Ctrl+Z, Alt+..., Cmd+...) and AltGr characters.
  if (e.ctrlKey || e.altKey || e.metaKey) return { type: 'boundary' };
  if (e.key === 'Backspace') return { type: 'backspace' };
  if ([...e.key].length === 1) return { type: 'char', ch: e.key };
  return { type: 'boundary' };
}
