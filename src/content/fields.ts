/** Decides which page elements Lekho may type into. */

export type EditableKind = 'text' | 'contenteditable';

/** Input types that hold free text. Everything else (password, email, number, tel, url, ...) is never touched. */
const TEXT_INPUT_TYPES = new Set(['text', 'search']);

/** inputmode values used for non-prose data such as one-time codes and phone numbers. */
const SKIPPED_INPUT_MODES = new Set(['numeric', 'decimal', 'tel', 'email', 'url', 'none']);

/**
 * autocomplete tokens that mark sensitive or non-prose fields. Password fields
 * with a "show password" toggle often switch to type="text" but keep
 * autocomplete="current-password", so these are checked too.
 */
const SKIPPED_AUTOCOMPLETE = [
  'one-time-code',
  'current-password',
  'new-password',
  'username',
  'email',
  'tel',
  'url',
  'cc-',
];

function hasSkippedAutocomplete(el: Element): boolean {
  const tokens = (el.getAttribute('autocomplete') ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  return tokens.some((t) => SKIPPED_AUTOCOMPLETE.some((s) => (s.endsWith('-') ? t.startsWith(s) : t === s)));
}

function hasSkippedInputMode(el: Element): boolean {
  return SKIPPED_INPUT_MODES.has((el.getAttribute('inputmode') ?? '').toLowerCase());
}

function isTag<K extends keyof HTMLElementTagNameMap>(el: Element, tag: K): el is HTMLElementTagNameMap[K] {
  return el.localName === tag && el.namespaceURI === 'http://www.w3.org/1999/xhtml';
}

export function editableKind(el: Element | null | undefined): EditableKind | null {
  if (!el) return null;

  if (isTag(el, 'input')) {
    if (!TEXT_INPUT_TYPES.has(el.type) || el.readOnly || el.disabled) return null;
    if (hasSkippedAutocomplete(el) || hasSkippedInputMode(el)) return null;
    return 'text';
  }
  if (isTag(el, 'textarea')) {
    if (el.readOnly || el.disabled) return null;
    if (hasSkippedAutocomplete(el) || hasSkippedInputMode(el)) return null;
    return 'text';
  }
  if ((el as Partial<HTMLElement>).isContentEditable === true) {
    if (hasSkippedInputMode(el)) return null;
    return 'contenteditable';
  }
  return null;
}

/** The element that really receives the key, looking through open shadow roots. */
export function deepTarget(e: Event): Element | null {
  const first = e.composedPath()[0];
  return first instanceof Element ? first : null;
}
