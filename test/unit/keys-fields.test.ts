// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { classifyKey } from '../../src/content/keys';
import { editableKind } from '../../src/content/fields';

const key = (k: string, extra: Partial<KeyboardEvent> = {}) =>
  classifyKey({ key: k, ctrlKey: false, altKey: false, metaKey: false, isComposing: false, keyCode: 0, ...extra });

describe('classifyKey', () => {
  it('turns printable keys into characters', () => {
    expect(key('a')).toEqual({ type: 'char', ch: 'a' });
    expect(key('A')).toEqual({ type: 'char', ch: 'A' });
    expect(key(' ')).toEqual({ type: 'char', ch: ' ' });
    expect(key('.')).toEqual({ type: 'char', ch: '.' });
  });

  it('recognises backspace', () => {
    expect(key('Backspace')).toEqual({ type: 'backspace' });
  });

  it('ignores modifier keys pressed alone', () => {
    for (const k of ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'AltGraph']) expect(key(k)).toEqual({ type: 'ignore' });
  });

  it('treats shortcuts, navigation and IME input as boundaries', () => {
    expect(key('a', { ctrlKey: true })).toEqual({ type: 'boundary' });
    expect(key('a', { altKey: true })).toEqual({ type: 'boundary' });
    expect(key('a', { metaKey: true })).toEqual({ type: 'boundary' });
    expect(key('a', { isComposing: true })).toEqual({ type: 'boundary' });
    expect(key('Process')).toEqual({ type: 'boundary' });
    expect(key('a', { keyCode: 229 })).toEqual({ type: 'boundary' });
    for (const k of ['Enter', 'Tab', 'Escape', 'ArrowLeft', 'Home', 'Delete', 'Dead', 'F5']) expect(key(k)).toEqual({ type: 'boundary' });
  });
});

describe('editableKind', () => {
  const make = (html: string) => {
    document.body.replaceChildren();
    const parsed = new DOMParser().parseFromString(html, 'text/html').body.firstElementChild;
    if (!parsed) throw new Error(`bad fixture: ${html}`);
    const el = document.importNode(parsed, true);
    document.body.append(el);
    return el;
  };

  it('accepts text, search, untyped inputs and textareas', () => {
    expect(editableKind(make('<input type="text">'))).toBe('text');
    expect(editableKind(make('<input type="search">'))).toBe('text');
    expect(editableKind(make('<input>'))).toBe('text');
    expect(editableKind(make('<textarea></textarea>'))).toBe('text');
  });

  it('never touches sensitive or non-prose input types', () => {
    for (const t of ['password', 'email', 'number', 'tel', 'url', 'date', 'checkbox', 'hidden']) {
      expect(editableKind(make(`<input type="${t}">`)), t).toBeNull();
    }
  });

  it('skips one-time-code, password and payment autocomplete fields', () => {
    for (const ac of ['one-time-code', 'current-password', 'new-password', 'cc-number', 'section-a cc-csc', 'username']) {
      expect(editableKind(make(`<input type="text" autocomplete="${ac}">`)), ac).toBeNull();
    }
    expect(editableKind(make('<textarea autocomplete="one-time-code"></textarea>'))).toBeNull();
    expect(editableKind(make('<input type="text" autocomplete="name">'))).toBe('text');
  });

  it('skips numeric input modes, read-only and disabled fields', () => {
    expect(editableKind(make('<input type="text" inputmode="numeric">'))).toBeNull();
    expect(editableKind(make('<input type="text" readonly>'))).toBeNull();
    expect(editableKind(make('<textarea disabled></textarea>'))).toBeNull();
  });

  it('recognises contenteditable elements', () => {
    // jsdom does not implement isContentEditable; emulate the browser.
    const el = make('<div contenteditable="true"></div>') as HTMLElement;
    Object.defineProperty(el, 'isContentEditable', { value: true });
    expect(editableKind(el)).toBe('contenteditable');
    expect(editableKind(make('<div></div>'))).toBeNull();
    expect(editableKind(null)).toBeNull();
  });
});
