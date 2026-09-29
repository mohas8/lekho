/** Extension service worker. All listeners are registered synchronously at startup. */
import { TOGGLE_COMMAND } from '../manifest';
import { isToWorker, MSG, type HelloReply, type SuggestReply } from '../shared/messages';
import { chromeTabApi } from './chromeApi';
import { chromeLearnedStorage, LEARNED_KEY, LearnedChoices } from './learned';
import { createSuggestService, packagedTableLoader } from './suggestService';
import { TabManager } from './tabs';
import { chromeSettingsArea, loadSettings, watchSettings, type Settings } from '../shared/settings';

const tabs = new TabManager(chromeTabApi);
const learned = new LearnedChoices(chromeLearnedStorage);

// Settings are read once per worker start and kept current by storage.onChanged.
let settings: Promise<Settings> = loadSettings(chromeSettingsArea);
watchSettings((s) => {
  settings = Promise.resolve(s);
});

const suggestions = createSuggestService(packagedTableLoader, {
  learned,
  remember: async () => (await settings).rememberChoices,
});

chrome.action.onClicked.addListener((tab) => {
  if (tab.id !== undefined) void tabs.toggle(tab.id);
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== TOGGLE_COMMAND) return;
  void (async () => {
    const id = tab?.id ?? (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0]?.id;
    if (id !== undefined) await tabs.toggle(id);
  })();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') void tabs.onPageLoaded(tabId);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void tabs.onTabRemoved(tabId);
});

// Another context (the options page) changed or cleared the learned words.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && LEARNED_KEY in changes) learned.invalidate();
});

chrome.runtime.onMessage.addListener((msg: unknown, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || !isToWorker(msg)) return false;
  const tabId = sender.tab?.id;
  if (msg.type === MSG.framesChanged) {
    if (tabId !== undefined) void tabs.onFramesChanged(tabId);
    return false;
  }
  if (msg.type === MSG.unsupported) {
    if (tabId !== undefined) void tabs.onUnsupported(tabId);
    return false;
  }
  if (msg.type === MSG.suggest) {
    const { id, roman } = msg;
    suggestions
      .suggest(roman)
      .then((r) => sendResponse({ id, roman, words: r?.words ?? [], preferred: r?.preferred } satisfies SuggestReply))
      .catch(() => sendResponse({ id, roman, words: [] } satisfies SuggestReply));
    return true; // async response
  }
  if (msg.type === MSG.learn) {
    void suggestions.learn(msg.roman, msg.word).catch(() => undefined);
    return false;
  }
  if (msg.type === MSG.hello) {
    if (tabId === undefined) {
      sendResponse({ enabled: false } satisfies HelloReply);
      return false;
    }
    void tabs.isEnabled(tabId).then((enabled) => sendResponse({ enabled } satisfies HelloReply));
    return true; // async response
  }
  return false;
});

if (__TEST__) {
  // Playwright can't click the toolbar icon, so test builds expose the same
  // actions. Stripped from production builds (see test/unit/build.test.ts).
  (globalThis as { __lekhoTest?: unknown }).__lekhoTest = {
    toggle: (tabId: number) => tabs.toggle(tabId),
    enable: (tabId: number) => tabs.enable(tabId),
    disable: (tabId: number) => tabs.disable(tabId),
    status: (tabId: number) => tabs.status(tabId),
  };
}
