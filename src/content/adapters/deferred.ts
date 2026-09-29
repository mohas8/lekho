/**
 * Deferred ("preview") adapter for editors that consume typed text instead of
 * keeping it in the DOM. Google Docs is the main case: it reads keystrokes
 * from a hidden iframe (.docs-texteventtarget-iframe), moves the text into
 * its own model and clears the iframe, so text can't be replaced in place.
 *
 * The word being typed is kept here and shown only in the suggestion popup;
 * the finished word is inserted once. Nothing already in the document is
 * ever deleted or replaced.
 */
import type { ApplyGuard, EditAdapter } from './types';
import { selectionFor } from './contentEditable';

export class DeferredAdapter implements EditAdapter {
  readonly deferred = true;
  private pending = '';

  constructor(
    readonly element: HTMLElement,
    private readonly guard: ApplyGuard,
    /** Where the user sees the caret (e.g. Docs' own caret in the top document), in top-document coordinates. */
    private readonly anchor: () => DOMRect | null = () => null,
  ) {}

  /** The text of the unfinished word (shown in the popup only). */
  get pendingText(): string {
    return this.pending;
  }

  replace(_before: string, after: string): boolean {
    this.pending = after;
    return true;
  }

  commit(text: string): void {
    this.pending = '';
    if (text !== '') this.insert(text);
  }

  /** Viewport rectangle of the caret, translated into the top-most same-origin document. */
  anchorRect(): DOMRect | null {
    const visible = this.anchor();
    if (visible) return visible;
    const el = this.element;
    let rect = el.getBoundingClientRect();
    const sel = selectionFor(el);
    if (sel && sel.rangeCount > 0) {
      const r = sel.getRangeAt(0).getBoundingClientRect();
      if (r.width > 0 || r.height > 0) rect = r;
    }
    const { x, y } = frameOffset(el.ownerDocument.defaultView);
    return new DOMRect(rect.left + x, rect.top + y, rect.width, rect.height);
  }

  private insert(text: string): void {
    const el = this.element;
    const doc = el.ownerDocument;
    this.guard.run(() => {
      const snapshot = el.textContent;
      const announce = new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        composed: true,
        inputType: 'insertText',
        data: text,
      });
      if (!el.dispatchEvent(announce) || el.textContent !== snapshot) return; // the editor took it
      let ok: boolean;
      try {
        ok = doc.execCommand('insertText', false, text);
      } catch {
        ok = false;
      }
      // Trust execCommand's result, not the DOM: consumers like Docs clear the
      // text again synchronously. Fall back to legacy keypress events only if
      // nothing could be inserted, so text is never inserted twice.
      if (!ok) {
        for (const ch of text) {
          const code = ch.codePointAt(0) ?? 0;
          el.dispatchEvent(
            new KeyboardEvent('keypress', { key: ch, charCode: code, keyCode: code, bubbles: true, cancelable: true }),
          );
        }
      }
    });
  }
}

/** Offset of a frame's viewport inside the top-most same-origin ancestor's viewport. */
export function frameOffset(win: Window | null): { x: number; y: number } {
  let x = 0;
  let y = 0;
  let w = win;
  while (w && w !== w.parent) {
    let fe: Element | null;
    try {
      fe = w.frameElement;
    } catch {
      fe = null;
    }
    if (!fe) break;
    const r = fe.getBoundingClientRect();
    x += r.left + fe.clientLeft;
    y += r.top + fe.clientTop;
    w = w.parent;
  }
  return { x, y };
}
