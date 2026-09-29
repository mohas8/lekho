/**
 * Content script entry. Injected on demand with chrome.scripting.executeScript
 * into every accessible frame of the tab (never declared in the manifest).
 * Injecting again into a frame that already has it only re-syncs the state.
 */
import { Controller, defaultAdapterFactory, keyTimings } from './controller';
import { DeferredAdapter } from './adapters/deferred';
import { docsCaretRect, DOCS_EVENT_FRAME_CLASS, isDocsEventFrame, isGoogleDocsEditor, topSameOriginDocument } from './docs';
import { watchFrames } from './frames';
import { SuggestClient } from './suggestClient';
import { SuggestionUi } from './suggestions';
import { SuggestionPopup } from './popup/popup';
import { DEFAULT_TRANSLITERATE_OPTIONS } from '../engine/transliterate';
import { isToContent, MSG, type HelloReply, type SuggestReply } from '../shared/messages';
import { chromeSettingsArea, loadSettings, watchSettings, type Settings } from '../shared/settings';

declare global {
  interface Window {
    /** Test builds only, when loaded outside the extension by a fixture page. */
    __lekho?: Controller;
  }
}

interface ContentGlobal {
  __lekhoContent?: { sync(): void };
}

function extensionAlive(): boolean {
  try {
    return typeof chrome !== 'undefined' && typeof chrome.runtime?.id === 'string';
  } catch {
    return false;
  }
}

/**
 * On Google Docs, typing works only through Docs' hidden input frame. If it
 * can't be found (Docs changed), say so on the toolbar badge instead of
 * silently doing nothing.
 */
function checkDocsInput(): void {
  if (window !== window.top || !isGoogleDocsEditor(location.href)) return;
  setTimeout(() => {
    if (!document.querySelector(`iframe.${DOCS_EVENT_FRAME_CLASS}`) && extensionAlive()) {
      chrome.runtime.sendMessage({ type: MSG.unsupported }).catch(() => undefined);
    }
  }, 3000);
}

function startInExtension(): void {
  const g = globalThis as ContentGlobal;
  if (g.__lekhoContent) {
    g.__lekhoContent.sync();
    return;
  }

  let ui: SuggestionUi | null = null;
  // Google Docs: keystrokes go to a hidden iframe whose text Docs consumes, so
  // words are previewed in the popup and inserted when finished; the popup
  // lives in the top document, where the user can see it.
  const docsFrame = isDocsEventFrame(window);
  const popupDoc = docsFrame ? topSameOriginDocument(window) : document;
  const popupWin = popupDoc.defaultView ?? window;
  const controller = new Controller(
    window,
    DEFAULT_TRANSLITERATE_OPTIONS,
    {
      isAlive: extensionAlive,
      onCompositionChange: (comp) => ui?.onCompositionChange(comp),
      interceptKey: (e) => ui?.interceptKey(e) ?? false,
      isOwnEvent: (e) => ui?.isOwnEvent(e) ?? false,
    },
    docsFrame
      ? (el, kind, guard) =>
          kind === 'contenteditable'
            ? new DeferredAdapter(el as HTMLElement, guard, () => docsCaretRect(popupDoc))
            : defaultAdapterFactory(el, kind, guard)
      : defaultAdapterFactory,
  );
  const client = new SuggestClient(
    (msg) => chrome.runtime.sendMessage(msg) as Promise<SuggestReply | undefined>,
    (msg) => void chrome.runtime.sendMessage(msg).catch(() => undefined),
  );
  const popup = new SuggestionPopup(popupDoc, (i) => ui?.choose(i));
  ui = new SuggestionUi(controller, client, popup, popupWin);
  controller.attach();
  if (docsFrame && popupWin !== window) {
    // A click in the document (outside the hidden input frame) moves Docs' caret: finish the word first.
    popupWin.addEventListener(
      'mousedown',
      (e) => {
        if (!ui?.isOwnEvent(e)) controller.finish();
      },
      true,
    );
  }

  // Settings apply to open tabs immediately.
  const applySettings = (s: Settings) => {
    controller.setOptions({ banglaDigits: s.banglaDigits, dotToDari: s.dotToDari });
    ui?.setEnabled(s.suggestions);
  };
  void loadSettings(chromeSettingsArea).then(applySettings);
  watchSettings(applySettings);

  const setEnabled = (on: boolean) => {
    controller.setEnabled(on);
    if (!on) ui?.hide();
    // Lets Playwright wait for the state; the page can't see content-script globals.
    if (__TEST__) document.documentElement.dataset.lekhoTest = on ? 'on' : 'off';
    if (on) checkDocsInput();
  };
  if (__TEST__) {
    document.addEventListener('lekho:perf-request', () => {
      document.documentElement.dataset.lekhoPerf = JSON.stringify(keyTimings);
    });
  }

  watchFrames(document, () => {
    if (controller.isEnabled && extensionAlive()) {
      chrome.runtime.sendMessage({ type: MSG.framesChanged }).catch(() => undefined);
    }
  });

  chrome.runtime.onMessage.addListener((msg: unknown, sender) => {
    if (sender.id === chrome.runtime.id && isToContent(msg)) setEnabled(msg.enabled);
    return false;
  });

  const sync = () => {
    chrome.runtime
      .sendMessage({ type: MSG.hello })
      .then((reply: HelloReply | undefined) => setEnabled(reply?.enabled === true))
      .catch(() => setEnabled(false));
  };
  g.__lekhoContent = { sync };
  sync();
}

if (extensionAlive()) {
  startInExtension();
} else if (__TEST__) {
  // Standalone mode for fixture pages that load dist-test/content.js directly.
  const controller = new Controller(window, DEFAULT_TRANSLITERATE_OPTIONS);
  controller.attach();
  controller.setEnabled(true);
  window.__lekho = controller;
}
