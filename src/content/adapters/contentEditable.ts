/**
 * Adapter for contenteditable editors (Gmail, Facebook, Slack, Notion, ...),
 * including designMode documents and editors inside open shadow roots.
 *
 * Only the current word, inside a single text node, is ever selected and
 * replaced, and always through execCommand, so the editor receives normal
 * beforeinput/input events. Editors that cancel beforeinput and apply the
 * change to their own model (Lexical, ProseMirror, Slate, ...) keep working:
 * success is judged by the text before the caret, not by DOM node identity.
 */
import type { ApplyGuard, EditAdapter } from './types';
import { editSpan } from './diff';

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

interface TextPosition {
  readonly node: Text;
  readonly offset: number;
}

type SelectionRoot = Node & { getSelection?: () => Selection | null };

export function selectionFor(el: Element): Selection | null {
  const root = el.getRootNode() as SelectionRoot;
  // Chrome exposes getSelection() on shadow roots; for documents it is the normal one.
  if (typeof root.getSelection === 'function') return root.getSelection();
  return el.ownerDocument.getSelection();
}

/** The text node and offset right before a collapsed caret inside `host`, if any. */
export function caretText(sel: Selection, host: Node): TextPosition | null {
  if (sel.rangeCount === 0 || !sel.isCollapsed) return null;
  const node = sel.focusNode;
  if (!node || !host.contains(node)) return null;
  if (node.nodeType === TEXT_NODE) return { node: node as Text, offset: sel.focusOffset };

  // Caret between child nodes: use the end of the text right before it.
  let prev: Node | null = sel.focusOffset > 0 ? (node.childNodes[sel.focusOffset - 1] ?? null) : null;
  while (prev && prev.nodeType === ELEMENT_NODE && (prev as Element).getAttribute('contenteditable') !== 'false') {
    prev = prev.lastChild;
  }
  if (prev && prev.nodeType === TEXT_NODE && host.contains(prev)) return { node: prev as Text, offset: (prev as Text).length };
  return null;
}

function endsWithAt(pos: TextPosition, text: string): boolean {
  return pos.offset >= text.length && pos.node.data.slice(pos.offset - text.length, pos.offset) === text;
}

export class ContentEditableAdapter implements EditAdapter {
  constructor(
    readonly element: HTMLElement,
    private readonly guard: ApplyGuard,
  ) {}

  replace(before: string, after: string): boolean {
    const el = this.element;
    const sel = selectionFor(el);
    if (!sel || sel.rangeCount === 0 || !sel.focusNode || !el.contains(sel.focusNode)) return false;

    if (before === '') {
      if (after === '') return true;
      const snapshot = el.textContent;
      const outcome = this.exec('insertText', after);
      return outcome === 'editor' || this.verify(after, snapshot, outcome === 'native');
    }

    const pos = caretText(sel, el);
    if (!pos || !endsWithAt(pos, before)) return false;
    if (before === after) return true;

    // Only the changed tail is edited; appending is a plain insertion at the caret, like native typing.
    const { keep, insert } = editSpan(before, after);
    const removeLen = before.length - keep;
    if (removeLen > 0) {
      const range = el.ownerDocument.createRange();
      range.setStart(pos.node, pos.offset - removeLen);
      range.setEnd(pos.node, pos.offset);
      sel.removeAllRanges();
      sel.addRange(range);
    }

    const snapshot = el.textContent;
    const outcome = this.exec(insert === '' ? 'delete' : 'insertText', insert);
    if (outcome === 'editor' || this.verify(after, snapshot, outcome === 'native')) return true;

    // Nothing was written: put the caret back where it was, never leave the word selected.
    if (pos.node.isConnected && pos.offset <= pos.node.length) sel.collapse(pos.node, pos.offset);
    else if (sel.rangeCount > 0) sel.collapseToEnd();
    return false;
  }

  anchorRect(length: number): DOMRect | null {
    const el = this.element;
    const sel = selectionFor(el);
    const pos = sel ? caretText(sel, el) : null;
    if (pos) {
      const range = el.ownerDocument.createRange();
      range.setStart(pos.node, Math.max(0, pos.offset - length));
      range.setEnd(pos.node, pos.offset);
      const rects = range.getClientRects();
      const last = rects[rects.length - 1];
      if (last && (last.width > 0 || last.height > 0)) return last;
      const rect = range.getBoundingClientRect();
      if (rect.width > 0 || rect.height > 0) return rect;
    }
    if (sel && sel.rangeCount > 0) {
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      if (rect.width > 0 || rect.height > 0) return rect;
    }
    return el.getBoundingClientRect();
  }

  /**
   * 'editor': the page's editor took the edit over (cancelled or reacted to
   * beforeinput); it may update the DOM later, e.g. in a microtask (Lexical).
   * 'native': execCommand ran. 'failed': nothing could be done.
   */
  private exec(command: 'insertText' | 'delete', text: string): 'editor' | 'native' | 'failed' {
    const el = this.element;
    return this.guard.run(() => {
      // execCommand never fires beforeinput (Input Events spec), and
      // model-driven editors (Lexical, Slate, ...) only apply edits they see
      // in beforeinput. So announce the edit first.
      const snapshot = el.textContent;
      const announce = new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        composed: true,
        inputType: command === 'delete' ? 'deleteContentBackward' : 'insertText',
        data: command === 'delete' ? null : text,
      });
      const notCancelled = el.dispatchEvent(announce);
      if (!notCancelled || el.textContent !== snapshot) return 'editor';
      try {
        return el.ownerDocument.execCommand(command, false, text) ? 'native' : 'failed';
      } catch {
        return 'failed';
      }
    });
  }

  /** Did the edit land? Checked by content, since editors may re-render text nodes. */
  private verify(after: string, snapshot: string | null, execOk: boolean): boolean {
    const el = this.element;
    const changed = el.textContent !== snapshot;
    if (after === '') return changed;
    const sel = selectionFor(el);
    const pos = sel ? caretText(sel, el) : null;
    if (pos && endsWithAt(pos, after)) return true;
    // The editor applied the change its own way (or will shortly); the next
    // replace re-checks the text and starts a new word if it doesn't match.
    return changed && execOk;
  }
}
