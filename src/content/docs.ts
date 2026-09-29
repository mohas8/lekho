/**
 * Google Docs support (best effort). Docs draws the document on a canvas and
 * reads keystrokes from a hidden same-origin iframe; Lekho types there in
 * deferred mode (see adapters/deferred.ts) and shows its popup in the top
 * document, where the user can see it.
 */

export const DOCS_EVENT_FRAME_CLASS = 'docs-texteventtarget-iframe';

/** True inside Docs' hidden keystroke iframe. */
export function isDocsEventFrame(win: Window): boolean {
  try {
    return win.frameElement?.classList.contains(DOCS_EVENT_FRAME_CLASS) === true;
  } catch {
    return false; // cross-origin parent
  }
}

/** Google Docs, Slides and Sheets editors. */
export function isGoogleDocsEditor(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname === 'docs.google.com' && /^\/(document|presentation|spreadsheets)\//.test(u.pathname);
  } catch {
    return false;
  }
}

/** The top-most same-origin document, where a popup for this frame is visible. */
export function topSameOriginDocument(win: Window): Document {
  let w = win;
  while (w !== w.parent) {
    try {
      const parentDoc = w.parent.document;
      if (!parentDoc) break;
      w = w.parent;
    } catch {
      break;
    }
  }
  return w.document;
}

/** Docs' own visible caret, used to place the popup next to it. */
export function docsCaretRect(doc: Document): DOMRect | null {
  const caret = doc.querySelector('.kix-cursor-caret') ?? doc.querySelector('.kix-cursor');
  if (!caret) return null;
  const r = caret.getBoundingClientRect();
  return r.width > 0 || r.height > 0 ? r : null;
}
