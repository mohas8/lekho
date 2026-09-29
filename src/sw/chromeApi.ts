/** Real Chrome implementation of TabApi. */
import type { BadgeState, TabApi, TabStatus } from './tabs';
import { TOGGLE_COMMAND } from '../manifest';

const key = (tabId: number) => `tab:${tabId}`;

const BADGE: Record<Exclude<BadgeState, 'none'>, { text: string; color: string }> = {
  on: { text: 'বাং', color: '#006a4e' },
  off: { text: 'EN', color: '#5f6368' },
  blocked: { text: '!', color: '#b3261e' },
  unsupported: { text: '!', color: '#b3261e' },
};

async function shortcut(): Promise<string> {
  try {
    const commands = await chrome.commands.getAll();
    return commands.find((c) => c.name === TOGGLE_COMMAND)?.shortcut ?? '';
  } catch {
    return '';
  }
}

async function titleFor(state: BadgeState): Promise<string> {
  const keys = await shortcut();
  const how = keys ? `click or press ${keys}` : 'click';
  switch (state) {
    case 'on':
      return `Lekho: Bangla typing is on for this tab (${how} to turn off)`;
    case 'off':
      return `Lekho: Bangla typing is off for this tab (${how} to turn on)`;
    case 'blocked':
      return "Lekho can't type on this page. Chrome protects its own pages (chrome://, the Web Store, the PDF viewer).";
    case 'unsupported':
      return `Lekho can't find this editor's text input, so Bangla typing may not work here. Other tabs are not affected (${how} to turn off).`;
    case 'none':
      return `Lekho: ${how} to type Bangla on this tab`;
  }
}

export const chromeTabApi: TabApi = {
  async inject(tabId) {
    await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: ['content.js'] });
  },

  async send(tabId, msg) {
    try {
      await chrome.tabs.sendMessage(tabId, msg);
    } catch {
      // No content script in the tab (e.g. the page was replaced): nothing to turn off.
    }
  },

  async setBadge(tabId, state) {
    try {
      await chrome.action.setTitle({ tabId, title: await titleFor(state) });
      if (state === 'none') {
        await chrome.action.setBadgeText({ tabId, text: '' });
        return;
      }
      const { text, color } = BADGE[state];
      await chrome.action.setBadgeBackgroundColor({ tabId, color });
      await chrome.action.setBadgeTextColor({ tabId, color: '#ffffff' });
      await chrome.action.setBadgeText({ tabId, text });
    } catch {
      // The tab was closed meanwhile.
    }
  },

  async loadStatus(tabId) {
    const k = key(tabId);
    const data = await chrome.storage.session.get(k);
    const v = data[k];
    return v === 'on' || v === 'off' || v === 'blocked' ? (v as TabStatus) : undefined;
  },

  async saveStatus(tabId, status) {
    await chrome.storage.session.set({ [key(tabId)]: status });
  },

  async clearStatus(tabId) {
    await chrome.storage.session.remove(key(tabId));
  },
};
