// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { caretText, ContentEditableAdapter } from '../../src/content/adapters/contentEditable';

const guard = { run: <T>(fn: () => T) => fn() };

/** Minimal Chrome-like insertText/delete: replaces the selected range in its text node. */
function installFakeExecCommand(): void {
  document.execCommand = (cmd: string, _ui?: boolean, value?: string) => {
    const sel = document.getSelection();
    if (!sel || sel.rangeCount === 0) return false;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    if (cmd === 'insertText' && value) {
      const node = range.startContainer;
      if (node.nodeType === 3) {
        const t = node as Text;
        const at = range.startOffset;
        t.insertData(at, value);
        sel.collapse(t, at + value.length);
      } else {
        const t = document.createTextNode(value);
        range.insertNode(t);
        sel.collapse(t, value.length);
      }
    } else {
      sel.collapse(range.startContainer, range.startOffset);
    }
    return true;
  };
}

function editor(html = ''): HTMLDivElement {
  document.body.replaceChildren();
  const el = document.createElement('div');
  el.contentEditable = 'true';
  if (html) el.append(document.importNode(new DOMParser().parseFromString(html, 'text/html').body, true));
  document.body.append(el);
  el.focus();
  return el;
}

function caretAtEnd(el: Node): void {
  const sel = document.getSelection()!;
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

describe('caretText', () => {
  it('finds the text node at a caret between elements', () => {
    const el = editor();
    el.append('abc', document.createElement('br'));
    const sel = document.getSelection()!;
    sel.collapse(el, 1); // after "abc", before <br>
    const pos = caretText(sel, el);
    expect(pos?.node.data).toBe('abc');
    expect(pos?.offset).toBe(3);
  });

  it('descends into the last text of an inline element', () => {
    const el = editor();
    const b = document.createElement('b');
    b.textContent = 'bold';
    el.append(b);
    document.getSelection()!.collapse(el, 1);
    expect(caretText(document.getSelection()!, el)?.node.data).toBe('bold');
  });

  it('returns null for a selection or a caret outside the host', () => {
    const el = editor();
    el.append('abc');
    const sel = document.getSelection()!;
    sel.setBaseAndExtent(el.firstChild!, 0, el.firstChild!, 2);
    expect(caretText(sel, el)).toBeNull();
    const other = document.createElement('p');
    other.textContent = 'x';
    document.body.append(other);
    sel.collapse(other.firstChild!, 1);
    expect(caretText(sel, el)).toBeNull();
  });
});

describe('ContentEditableAdapter', () => {
  let el: HTMLDivElement;
  beforeEach(() => {
    installFakeExecCommand();
    el = editor();
    caretAtEnd(el);
  });

  it('inserts, replaces and deletes the word before the caret', () => {
    const a = new ContentEditableAdapter(el, guard);
    expect(a.replace('', 'ক')).toBe(true);
    expect(a.replace('ক', 'কর')).toBe(true);
    expect(el.textContent).toBe('কর');
    expect(a.replace('কর', '')).toBe(true);
    expect(el.textContent).toBe('');
  });

  it('only touches the current word, never earlier text', () => {
    el.append('আমি ');
    caretAtEnd(el);
    const a = new ContentEditableAdapter(el, guard);
    a.replace('', 'ক');
    a.replace('ক', 'কর্ম');
    expect(el.textContent).toBe('আমি কর্ম');
  });

  it('refuses when the text before the caret is not the word', () => {
    el.append('abc');
    caretAtEnd(el);
    const a = new ContentEditableAdapter(el, guard);
    expect(a.replace('ক', 'কর')).toBe(false);
    expect(el.textContent).toBe('abc');
    expect(document.getSelection()!.isCollapsed).toBe(true);
  });

  it('lets an editor that cancels beforeinput apply the edit itself', () => {
    let model = '';
    el.addEventListener('beforeinput', (e) => {
      e.preventDefault();
      const ie = e as InputEvent;
      model = ie.inputType === 'insertText' ? model + (ie.data ?? '') : model;
      el.textContent = model;
      caretAtEnd(el);
    });
    const a = new ContentEditableAdapter(el, guard);
    expect(a.replace('', 'আ')).toBe(true);
    expect(el.textContent).toBe('আ');
  });

  it('announces edits with a cancelable beforeinput carrying the text', () => {
    const seen: Array<[string, string | null, boolean]> = [];
    el.addEventListener('beforeinput', (e) => {
      const ie = e as InputEvent;
      seen.push([ie.inputType, ie.data, ie.cancelable]);
    });
    const a = new ContentEditableAdapter(el, guard);
    a.replace('', 'ক');
    a.replace('ক', '');
    expect(seen).toEqual([
      ['insertText', 'ক', true],
      ['deleteContentBackward', null, true],
    ]);
  });
});
