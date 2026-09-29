/**
 * Per-tab on/off state and injection.
 *
 * Access to a page comes only from the activeTab grant, which Chrome gives
 * when the user clicks the toolbar icon or presses the shortcut. It lasts
 * while the tab stays on the same site, so after a reload or same-site
 * navigation the content script can be injected again; after a cross-site
 * navigation injection fails and the tab goes back to "not active".
 */
import type { ToContent } from '../shared/messages';

export type TabStatus = 'on' | 'off' | 'blocked';
/** 'unsupported': on, but the page's editor can't be typed into (shown as "!"). */
export type BadgeState = TabStatus | 'none' | 'unsupported';

/** Browser operations the manager needs; the real implementation is in chromeApi.ts. */
export interface TabApi {
  /** Injects content.js into every frame of the tab that the extension may access. Throws if the page can't be scripted. */
  inject(tabId: number): Promise<void>;
  /** Sends a message to all frames of the tab; errors (no listener) are ignored. */
  send(tabId: number, msg: ToContent): Promise<void>;
  setBadge(tabId: number, state: BadgeState): Promise<void>;
  loadStatus(tabId: number): Promise<TabStatus | undefined>;
  saveStatus(tabId: number, status: TabStatus): Promise<void>;
  clearStatus(tabId: number): Promise<void>;
}

export class TabManager {
  constructor(
    private readonly api: TabApi,
    /**
     * Wait before retrying a failed injection. Right after an icon click, Chrome
     * has occasionally not applied the activeTab grant yet when the click
     * handler runs; one retry avoids reporting a normal page as blocked.
     */
    private readonly retryDelay: () => Promise<void> = () => new Promise((r) => setTimeout(r, 200)),
  ) {}

  /** Injects, retrying once; throws if both attempts fail. */
  private async injectWithRetry(tabId: number): Promise<void> {
    try {
      await this.api.inject(tabId);
    } catch {
      await this.retryDelay();
      await this.api.inject(tabId);
    }
  }

  async status(tabId: number): Promise<TabStatus | undefined> {
    return this.api.loadStatus(tabId);
  }

  async isEnabled(tabId: number): Promise<boolean> {
    return (await this.api.loadStatus(tabId)) === 'on';
  }

  /** Icon click or shortcut. */
  async toggle(tabId: number): Promise<TabStatus> {
    return (await this.isEnabled(tabId)) ? this.disable(tabId) : this.enable(tabId);
  }

  async enable(tabId: number): Promise<TabStatus> {
    // Save first: the injected script asks for its state as soon as it loads.
    await this.api.saveStatus(tabId, 'on');
    try {
      await this.injectWithRetry(tabId);
    } catch {
      await this.api.saveStatus(tabId, 'blocked');
      await this.api.setBadge(tabId, 'blocked');
      return 'blocked';
    }
    await this.api.setBadge(tabId, 'on');
    return 'on';
  }

  async disable(tabId: number): Promise<TabStatus> {
    await this.api.saveStatus(tabId, 'off');
    await this.api.send(tabId, { type: 'lekho:set-enabled', enabled: false });
    await this.api.setBadge(tabId, 'off');
    return 'off';
  }

  /** The tab finished loading a new document (reload or navigation). */
  async onPageLoaded(tabId: number): Promise<void> {
    const status = await this.api.loadStatus(tabId);
    if (status === undefined) return;
    if (status !== 'on') {
      // The new document has no content script; start from "not active".
      await this.api.clearStatus(tabId);
      await this.api.setBadge(tabId, 'none');
      return;
    }
    try {
      await this.api.inject(tabId);
      await this.api.setBadge(tabId, 'on');
    } catch {
      // Typically a cross-site navigation: the activeTab grant is gone.
      await this.api.clearStatus(tabId);
      await this.api.setBadge(tabId, 'none');
    }
  }

  /** A frame of an enabled tab added or navigated an iframe: inject into the new frames too. */
  async onFramesChanged(tabId: number): Promise<void> {
    if (!(await this.isEnabled(tabId))) return;
    try {
      // Frames that already have the script only re-sync.
      await this.api.inject(tabId);
    } catch {
      // The tab left the site meanwhile; onPageLoaded cleans up.
    }
  }

  /** The page reported that its editor can't be typed into (e.g. Google Docs changed how it takes input). */
  async onUnsupported(tabId: number): Promise<void> {
    if (await this.isEnabled(tabId)) await this.api.setBadge(tabId, 'unsupported');
  }

  async onTabRemoved(tabId: number): Promise<void> {
    await this.api.clearStatus(tabId);
  }
}
