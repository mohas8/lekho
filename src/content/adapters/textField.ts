/** Adapter for <input type=text|search> and <textarea>. */
import type { ApplyGuard, EditAdapter } from './types';
import { textFieldRangeRect } from './caret';
import { editSpan } from './diff';

export type TextField = HTMLInputElement | HTMLTextAreaElement;

export class TextFieldAdapter implements EditAdapter {
  /** Caret position after our last write; null before the first write of a word. */
  private expectedCaret: number | null = null;

  constructor(
    readonly element: TextField,
    private readonly guard: ApplyGuard,
  ) {}

  replace(before: string, after: string): boolean {
    const el = this.element;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    if (start === null || end === null) return false;

    let from = start;
    let to = end;
    let insert = after;
    if (before !== '') {
      if (start !== end) return false;
      if (this.expectedCaret !== null && start !== this.expectedCaret) return false;
      if (start < before.length || el.value.slice(start - before.length, start) !== before) return false;
      if (before === after) return true;
      // Only the changed tail is edited: typing "ami" appends ম then ি at the
      // caret, exactly like native typing, instead of rewriting the word.
      const span = editSpan(before, after);
      from = start - (before.length - span.keep);
      to = start;
      insert = span.insert;
    }
    if (from === to && insert === '') return true;

    const expected = from + insert.length;
    let ok = false;
    this.guard.run(() => {
      if (from !== start || to !== end) el.setSelectionRange(from, to);
      let done: boolean;
      try {
        // execCommand keeps the browser's undo history and fires the normal
        // beforeinput/input events, so frameworks (React, Vue, ...) see the change.
        done = el.ownerDocument.execCommand(insert === '' ? 'delete' : 'insertText', false, insert);
      } catch {
        done = false;
      }
      ok = done && el.selectionStart === expected && el.selectionEnd === expected;
      if (!ok && el.selectionStart === from && el.selectionEnd === to) {
        // Nothing was written (execCommand unsupported): fall back once, so text is never inserted twice.
        el.setRangeText(insert, from, to, 'end');
        el.dispatchEvent(
          new InputEvent('input', {
            bubbles: true,
            composed: true,
            inputType: insert === '' ? 'deleteContentBackward' : 'insertText',
            data: insert === '' ? null : insert,
          }),
        );
        ok = el.selectionStart === expected && el.selectionEnd === expected;
      }
    });

    if (!ok) {
      // The page blocked or rewrote the edit. Never leave the word selected.
      if (el.selectionStart !== el.selectionEnd) el.setSelectionRange(el.selectionEnd, el.selectionEnd);
      this.expectedCaret = null;
      // If our text did land (a page rewrote it after), the next check decides.
      return el.value.slice(from, expected) === insert;
    }
    this.expectedCaret = expected;
    return true;
  }

  anchorRect(length: number): DOMRect | null {
    const el = this.element;
    const end = el.selectionEnd ?? el.value.length;
    return textFieldRangeRect(el, Math.max(0, end - length), end);
  }
}
