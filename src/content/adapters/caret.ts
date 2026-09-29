/**
 * Screen position of text inside an <input> or <textarea>. Those elements
 * don't expose their text layout, so a hidden copy with the same box and
 * text styles is measured instead (the usual "mirror element" technique).
 */
import type { TextField } from './textField';

/** Styles that affect where text is laid out. */
const COPIED = [
  'direction',
  'border-top-width',
  'border-right-width',
  'border-bottom-width',
  'border-left-width',
  'border-style',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'font-style',
  'font-variant',
  'font-weight',
  'font-stretch',
  'font-size',
  'font-size-adjust',
  'line-height',
  'font-family',
  'font-feature-settings',
  'font-kerning',
  'text-align',
  'text-transform',
  'text-indent',
  'letter-spacing',
  'word-spacing',
  'tab-size',
  'word-break',
  'overflow-wrap',
  'white-space',
];

/** Rectangle of value[start, end) in viewport coordinates, clamped to the field's box. */
export function textFieldRangeRect(el: TextField, start: number, end: number): DOMRect {
  const doc = el.ownerDocument;
  const win = doc.defaultView;
  const box = el.getBoundingClientRect();
  if (!win) return box;
  const cs = win.getComputedStyle(el);
  const isInput = el.localName === 'input';

  const mirror = doc.createElement('div');
  const s = mirror.style;
  for (const p of COPIED) s.setProperty(p, cs.getPropertyValue(p));
  s.setProperty('position', 'fixed');
  s.setProperty('visibility', 'hidden');
  s.setProperty('pointer-events', 'none');
  s.setProperty('overflow', 'hidden');
  s.setProperty('margin', '0');
  s.setProperty('box-sizing', 'border-box');
  s.setProperty('top', `${box.top}px`);
  s.setProperty('left', `${box.left}px`);
  s.setProperty('width', `${box.width}px`);
  s.setProperty('height', `${box.height}px`);
  if (isInput) {
    // Single line, vertically centred like the real input.
    s.setProperty('white-space', 'pre');
    const inner = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    if (inner > 0) s.setProperty('line-height', `${inner}px`);
  } else {
    if (cs.whiteSpace === 'normal' || cs.whiteSpace === '') s.setProperty('white-space', 'pre-wrap');
    // Account for the textarea's scrollbar.
    const scrollbar = el.offsetWidth - el.clientWidth - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth);
    if (scrollbar > 0) s.setProperty('padding-right', `${parseFloat(cs.paddingRight) + scrollbar}px`);
  }

  const value = el.value;
  mirror.append(doc.createTextNode(value.slice(0, start)));
  const span = doc.createElement('span');
  // A zero-width space keeps an empty range measurable.
  span.textContent = value.slice(start, end) || '\u200b';
  mirror.append(span);

  doc.documentElement.append(mirror);
  try {
    mirror.scrollTop = el.scrollTop;
    mirror.scrollLeft = el.scrollLeft;
    const r = span.getClientRects();
    const last = r[r.length - 1] ?? span.getBoundingClientRect();
    const left = Math.min(Math.max(last.left, box.left), box.right);
    const top = Math.min(Math.max(last.top, box.top), box.bottom);
    const bottom = Math.min(Math.max(last.bottom, box.top), box.bottom);
    const right = Math.min(Math.max(last.right, left), box.right);
    return new DOMRect(left, top, right - left, bottom - top);
  } finally {
    mirror.remove();
  }
}
