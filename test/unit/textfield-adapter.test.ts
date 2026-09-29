// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { TextFieldAdapter } from '../../src/content/adapters/textField';

const guard = { run: <T>(fn: () => T) => fn() };

describe('TextFieldAdapter (setRangeText fallback path)', () => {
  let el: HTMLTextAreaElement;
  let inputs: string[];

  beforeEach(() => {
    document.body.replaceChildren();
    el = document.createElement('textarea');
    document.body.append(el);
    el.focus();
    inputs = [];
    el.addEventListener('input', (e) => inputs.push((e as InputEvent).inputType));
    // jsdom has no execCommand; make it report "not supported" like old engines.
    document.execCommand = () => false;
  });

  it('inserts, replaces and deletes the word before the caret', () => {
    const a = new TextFieldAdapter(el, guard);
    expect(a.replace('', 'ক')).toBe(true);
    expect(a.replace('ক', 'কর')).toBe(true);
    expect(el.value).toBe('কর');
    expect(el.selectionStart).toBe(2);
    expect(a.replace('কর', '')).toBe(true);
    expect(el.value).toBe('');
    expect(inputs).toEqual(['insertText', 'insertText', 'deleteContentBackward']);
  });

  it('inserts in the middle of existing text', () => {
    el.value = 'ab';
    el.setSelectionRange(1, 1);
    const a = new TextFieldAdapter(el, guard);
    expect(a.replace('', 'আ')).toBe(true);
    expect(a.replace('আ', 'আম')).toBe(true);
    expect(el.value).toBe('aআমb');
    expect(el.selectionStart).toBe(3);
  });

  it('refuses to replace when the text before the caret changed', () => {
    const a = new TextFieldAdapter(el, guard);
    a.replace('', 'আমি');
    el.value = 'আমX';
    el.setSelectionRange(3, 3);
    expect(a.replace('আমি', 'আমিক')).toBe(false);
    expect(el.value).toBe('আমX');
  });

  it('refuses to replace when the caret moved', () => {
    el.value = 'আমি আমি';
    el.setSelectionRange(3, 3);
    const a = new TextFieldAdapter(el, guard);
    expect(a.replace('', ' ')).toBe(true); // caret now at 4
    el.setSelectionRange(8, 8); // "আমি" also ends here, but the caret moved
    expect(a.replace(' ', 'x')).toBe(false);
  });

  it('refuses to replace over a selection, but a new word replaces the selection', () => {
    el.value = 'hello';
    el.setSelectionRange(0, 5);
    const a = new TextFieldAdapter(el, guard);
    expect(a.replace('hello', 'x')).toBe(false);
    expect(a.replace('', 'আ')).toBe(true);
    expect(el.value).toBe('আ');
  });
});
