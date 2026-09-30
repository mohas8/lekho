/**
 * The suggestion popup: a list of candidates shown under the word being typed.
 *
 * Isolation from the page:
 *  - Lives in a shadow root (closed in production; open in test builds so
 *    Playwright and axe can inspect it) under an unknown element name, with
 *    all page styles reset.
 *  - Uses the top layer (popover="manual") when available, so it shows above
 *    modal dialogs, and never takes focus.
 *  - Built only with DOM APIs and textContent; page text is never parsed as HTML.
 */
import type { CandidateState } from './candidates';

const STYLE = `
.box {
  all: initial;
  display: block;
  font: medium/1.45 "Noto Sans Bengali", "Nirmala UI", "Vrinda", "Kohinoor Bangla", "Bangla Sangam MN", system-ui, sans-serif;
  background: #ffffff;
  color: #1f1f1f;
  border: 1px solid #747775;
  border-radius: 0.5em;
  box-shadow: 0 0.25em 1em rgba(0, 0, 0, 0.18);
  padding: 0.25em;
  min-width: 6em;
  max-width: min(90vw, 30em);
  box-sizing: border-box;
}
ul { list-style: none; margin: 0; padding: 0; }
.sr {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  border: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
li {
  display: flex;
  align-items: baseline;
  gap: 0.6em;
  padding: 0.1em 0.6em;
  border-radius: 0.3em;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
li:hover { background: #e9eef6; }
li[aria-selected="true"] { background: #0b57d0; color: #ffffff; }
.n { font-size: 0.8em; color: #5e5e5e; min-width: 1ch; font-variant-numeric: tabular-nums; }
li[aria-selected="true"] .n { color: #ffffff; }
.en { font-family: system-ui, sans-serif; }
@media (prefers-color-scheme: dark) {
  .box { background: #2b2b2b; color: #e8e8e8; border-color: #8e918f; }
  li:hover { background: #3c4043; }
  li[aria-selected="true"] { background: #a8c7fa; color: #062e6f; }
  .n { color: #c4c7c5; }
  li[aria-selected="true"] .n { color: #062e6f; }
}
@media (forced-colors: active) {
  li[aria-selected="true"] { forced-color-adjust: none; background: Highlight; color: HighlightText; }
  li[aria-selected="true"] .n { color: HighlightText; }
}
`;

const GAP = 4;
let instances = 0;

export class SuggestionPopup {
  readonly host: HTMLElement;
  private readonly root: ShadowRoot;
  private readonly box: HTMLDivElement;
  private readonly list: HTMLUListElement;
  private readonly status: HTMLDivElement;
  private readonly idPrefix: string;
  private items: HTMLLIElement[] = [];
  private shown = false;
  private renderedWords: readonly string[] = [];

  constructor(
    private readonly doc: Document,
    private readonly onChoose: (index: number) => void,
    mode: ShadowRootMode = __TEST__ ? 'open' : 'closed',
  ) {
    this.idPrefix = `lekho-${++instances}-`;
    this.host = doc.createElement('lekho-suggestions');
    this.host.setAttribute('data-lekho-popup', '');
    if ('popover' in this.host) this.host.popover = 'manual';
    // Inline !important styles beat any page rule for this element. (A :host
    // rule can't be used for this: an !important :host declaration would
    // override these inline ones.)
    const s = this.host.style;
    for (const [p, v] of [
      ['all', 'initial'],
      ['position', 'fixed'],
      ['inset', 'auto'],
      ['top', '0px'],
      ['left', '0px'],
      ['margin', '0'],
      ['padding', '0'],
      ['border', '0'],
      ['background', 'transparent'],
      ['overflow', 'visible'],
      ['width', 'max-content'],
      ['height', 'max-content'],
      ['z-index', '2147483647'],
      ['display', 'none'],
    ] as const) {
      s.setProperty(p, v, 'important');
    }

    this.root = this.host.attachShadow({ mode });
    const style = doc.createElement('style');
    style.textContent = STYLE;
    this.box = doc.createElement('div');
    this.box.className = 'box';
    this.list = doc.createElement('ul');
    this.list.setAttribute('role', 'listbox');
    this.list.setAttribute('aria-label', 'Bangla suggestions');
    this.list.id = `${this.idPrefix}list`;
    // Screen readers can't follow a list that never takes focus, so changes of
    // the highlighted candidate are announced through a polite live region.
    this.status = doc.createElement('div');
    this.status.className = 'sr';
    this.status.setAttribute('role', 'status');
    this.status.setAttribute('aria-live', 'polite');
    this.status.setAttribute('aria-atomic', 'true');
    this.box.append(this.list);
    this.root.append(style, this.box, this.status);

    // Keep focus (and the caret) in the page's field when a candidate is clicked.
    this.box.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    this.box.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const li = (e.target as Element | null)?.closest?.('li');
      const i = li ? this.items.indexOf(li as HTMLLIElement) : -1;
      if (i >= 0) this.onChoose(i);
    });
  }

  get visible(): boolean {
    return this.shown;
  }

  /** Shows (or updates) the list below `anchor`, a viewport rectangle of the word being typed. */
  show(state: CandidateState, anchor: DOMRect | null): void {
    if (!this.host.isConnected) this.doc.documentElement.append(this.host);
    if (!sameWords(this.renderedWords, state.words)) this.renderItems(state);
    const wasShown = this.shown;
    const selectionChanged = this.renderSelection(state);
    if (!this.shown) {
      this.host.style.setProperty('display', 'block', 'important');
      if (typeof this.host.showPopover === 'function') {
        try {
          this.host.showPopover();
        } catch {
          // Already open, or the document doesn't allow it; stays a fixed element.
        }
      }
      this.shown = true;
    }
    this.place(anchor);
    // While typing, announce only a non-default highlight (a remembered choice); arrow keys announce via update().
    if (state.selected !== 0 && (selectionChanged || !wasShown)) this.announce(state);
  }

  /** Updates only which candidate is highlighted. */
  update(state: CandidateState): void {
    if (!this.shown) return;
    this.renderSelection(state);
    this.announce(state);
  }

  hide(): void {
    if (!this.shown) return;
    this.shown = false;
    this.status.textContent = '';
    if (typeof this.host.hidePopover === 'function') {
      try {
        this.host.hidePopover();
      } catch {
        // not open
      }
    }
    this.host.style.setProperty('display', 'none', 'important');
  }

  destroy(): void {
    this.hide();
    this.host.remove();
  }

  /** The element that describes the current choice (for aria-activedescendant-style announcements). */
  optionId(index: number): string {
    return `${this.idPrefix}opt-${index}`;
  }

  private renderItems(state: CandidateState): void {
    const doc = this.doc;
    const englishIndex = state.words.length - 1;
    this.items = state.words.map((word, i) => {
      const li = doc.createElement('li');
      li.id = this.optionId(i);
      li.setAttribute('role', 'option');
      const n = doc.createElement('span');
      n.className = 'n';
      n.setAttribute('aria-hidden', 'true');
      n.textContent = String(i + 1);
      const w = doc.createElement('span');
      w.className = 'w';
      w.textContent = word;
      if (i === englishIndex && word === state.roman) {
        w.classList.add('en');
        w.lang = 'en';
        li.setAttribute('aria-label', `${word} (English)`);
      } else {
        w.lang = 'bn';
      }
      li.append(n, w);
      return li;
    });
    this.list.replaceChildren(...this.items);
    this.renderedWords = state.words;
  }

  /** Returns true if the highlighted item changed. */
  private renderSelection(state: CandidateState): boolean {
    let changed = false;
    this.items.forEach((li, i) => {
      const v = String(i === state.selected);
      if (li.getAttribute('aria-selected') !== v) {
        li.setAttribute('aria-selected', v);
        if (v === 'true') changed = true;
      }
    });
    const current = this.items[state.selected];
    if (current) this.list.setAttribute('aria-activedescendant', current.id);
    return changed;
  }

  private announce(state: CandidateState): void {
    const word = state.words[state.selected];
    if (word === undefined) return;
    const english = state.selected === state.words.length - 1 && word === state.roman;
    this.status.textContent = `${word}${english ? ' (English)' : ''}, ${state.selected + 1} of ${state.words.length}`;
  }

  private place(anchor: DOMRect | null): void {
    const win = this.doc.defaultView;
    if (!win) return;
    const vw = win.innerWidth;
    const vh = win.innerHeight;
    const a = anchor ?? new DOMRect(GAP, GAP, 0, 0);
    // The word scrolled out of view: hide the list rather than pin it to the screen edge.
    // (Set on the box: its `all: initial` would ignore a value inherited from the host.)
    const offscreen = a.bottom < 0 || a.top > vh || a.right < 0 || a.left > vw;
    this.box.style.visibility = offscreen ? 'hidden' : 'visible';
    if (offscreen) return;
    const w = this.box.offsetWidth;
    const h = this.box.offsetHeight;

    let top = a.bottom + GAP;
    if (top + h > vh - GAP && a.top - GAP - h >= GAP) top = a.top - GAP - h; // no room below: go above
    top = Math.max(GAP, Math.min(top, vh - h - GAP));
    const left = Math.max(GAP, Math.min(a.left, vw - w - GAP));

    this.host.style.setProperty('top', `${Math.round(top)}px`, 'important');
    this.host.style.setProperty('left', `${Math.round(left)}px`, 'important');
  }
}

function sameWords(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((w, i) => w === b[i]);
}
