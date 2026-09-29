/**
 * Watches the document for iframes that are added or navigated after Lekho
 * was turned on, so the service worker can inject into them too (rich editors
 * often live in frames created on demand).
 */
const FRAME_TAGS = new Set(['iframe', 'frame']);

function containsFrame(node: Node): boolean {
  if (node.nodeType !== 1) return false;
  const el = node as Element;
  return FRAME_TAGS.has(el.localName) || el.querySelector('iframe, frame') !== null;
}

export function watchFrames(doc: Document, onChange: () => void, delayMs = 150): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      onChange();
    }, delayMs);
  };

  // "load" doesn't bubble, but capture listeners on the document still see it.
  const onLoad = (e: Event) => {
    const t = e.target;
    if (t instanceof Element && FRAME_TAGS.has(t.localName)) schedule();
  };
  doc.addEventListener('load', onLoad, true);

  const observer = new MutationObserver((records) => {
    for (const r of records) {
      for (const n of r.addedNodes) {
        if (containsFrame(n)) {
          schedule();
          return;
        }
      }
    }
  });
  observer.observe(doc, { childList: true, subtree: true });

  return () => {
    if (timer !== undefined) clearTimeout(timer);
    doc.removeEventListener('load', onLoad, true);
    observer.disconnect();
  };
}
