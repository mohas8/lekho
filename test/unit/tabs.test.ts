import { beforeEach, describe, expect, it } from 'vitest';
import { TabManager, type BadgeState, type TabApi, type TabStatus } from '../../src/sw/tabs';
import type { ToContent } from '../../src/shared/messages';

class FakeApi implements TabApi {
  statuses = new Map<number, TabStatus>();
  badges = new Map<number, BadgeState>();
  injected: number[] = [];
  sent: Array<[number, ToContent]> = [];
  /** Tabs whose pages can't be scripted (chrome://, Web Store, lost activeTab grant). */
  blocked = new Set<number>();

  async inject(tabId: number) {
    if (this.blocked.has(tabId)) throw new Error('Cannot access contents of the page');
    this.injected.push(tabId);
  }
  async send(tabId: number, msg: ToContent) {
    this.sent.push([tabId, msg]);
  }
  async setBadge(tabId: number, state: BadgeState) {
    this.badges.set(tabId, state);
  }
  async loadStatus(tabId: number) {
    return this.statuses.get(tabId);
  }
  async saveStatus(tabId: number, status: TabStatus) {
    this.statuses.set(tabId, status);
  }
  async clearStatus(tabId: number) {
    this.statuses.delete(tabId);
  }
}

describe('TabManager', () => {
  let api: FakeApi;
  let tabs: TabManager;
  beforeEach(() => {
    api = new FakeApi();
    tabs = new TabManager(api, async () => undefined);
  });

  it('retries once when the activeTab grant arrives just after the click', async () => {
    let attempts = 0;
    const inject = api.inject.bind(api);
    api.inject = async (id: number) => {
      if (++attempts === 1) throw new Error('Cannot access contents of the page');
      return inject(id);
    };
    expect(await tabs.toggle(1)).toBe('on');
    expect(attempts).toBe(2);
    expect(api.badges.get(1)).toBe('on');
  });

  it('a protected page fails both attempts and reports blocked', async () => {
    let attempts = 0;
    api.inject = async () => {
      attempts++;
      throw new Error('Cannot access a chrome:// URL');
    };
    expect(await tabs.toggle(1)).toBe('blocked');
    expect(attempts).toBe(2);
  });

  it('first toggle injects and turns Bangla on', async () => {
    expect(await tabs.toggle(1)).toBe('on');
    expect(api.injected).toEqual([1]);
    expect(api.statuses.get(1)).toBe('on');
    expect(api.badges.get(1)).toBe('on');
  });

  it('second toggle turns it off without injecting again', async () => {
    await tabs.toggle(1);
    expect(await tabs.toggle(1)).toBe('off');
    expect(api.injected).toEqual([1]);
    expect(api.sent).toEqual([[1, { type: 'lekho:set-enabled', enabled: false }]]);
    expect(api.badges.get(1)).toBe('off');
  });

  it('turning on again re-injects, which re-syncs an existing script', async () => {
    await tabs.toggle(1);
    await tabs.toggle(1);
    expect(await tabs.toggle(1)).toBe('on');
    expect(api.injected).toEqual([1, 1]);
  });

  it('protected pages show the blocked badge', async () => {
    api.blocked.add(7);
    expect(await tabs.toggle(7)).toBe('blocked');
    expect(api.badges.get(7)).toBe('blocked');
    expect(await tabs.isEnabled(7)).toBe(false);
    // Trying again still reports blocked rather than "off".
    expect(await tabs.toggle(7)).toBe('blocked');
  });

  it('re-injects after a reload while on', async () => {
    await tabs.enable(1);
    await tabs.onPageLoaded(1);
    expect(api.injected).toEqual([1, 1]);
    expect(api.badges.get(1)).toBe('on');
  });

  it('clears the state when re-injection fails (cross-site navigation)', async () => {
    await tabs.enable(1);
    api.blocked.add(1);
    await tabs.onPageLoaded(1);
    expect(await tabs.status(1)).toBeUndefined();
    expect(api.badges.get(1)).toBe('none');
  });

  it('forgets "off" and "blocked" when a new page loads', async () => {
    await tabs.enable(1);
    await tabs.disable(1);
    await tabs.onPageLoaded(1);
    expect(await tabs.status(1)).toBeUndefined();
    expect(api.badges.get(1)).toBe('none');
    expect(api.injected).toEqual([1]);
  });

  it('ignores page loads in tabs it never touched', async () => {
    await tabs.onPageLoaded(3);
    expect(api.badges.size).toBe(0);
    expect(api.injected).toEqual([]);
  });

  it('drops state when the tab closes', async () => {
    await tabs.enable(1);
    await tabs.onTabRemoved(1);
    expect(await tabs.status(1)).toBeUndefined();
  });
});
