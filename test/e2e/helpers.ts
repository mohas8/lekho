import type { Page, Worker } from '@playwright/test';

export interface TestHook {
  toggle(tabId: number): Promise<string>;
  enable(tabId: number): Promise<string>;
  disable(tabId: number): Promise<string>;
  status(tabId: number): Promise<string | undefined>;
}

/** Finds the Chrome tab id of a Playwright page (the test build can see localhost URLs). */
export async function tabIdOf(sw: Worker, page: Page): Promise<number> {
  await page.bringToFront();
  const url = page.url();
  const id = await sw.evaluate(async (u) => {
    const all = await chrome.tabs.query({});
    const byUrl = all.find((t) => t.url === u);
    if (byUrl?.id !== undefined) return byUrl.id;
    const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return active?.id ?? -1;
  }, url);
  if (id < 0) throw new Error(`No tab for ${url}`);
  return id;
}

/** Calls the service-worker test hook, like a toolbar click would. */
export async function hook<K extends keyof TestHook>(sw: Worker, action: K, tabId: number): Promise<Awaited<ReturnType<TestHook[K]>>> {
  return sw.evaluate(
    ([a, id]) => (globalThis as unknown as { __lekhoTest: TestHook }).__lekhoTest[a](id),
    [action, tabId] as const,
  ) as Promise<Awaited<ReturnType<TestHook[K]>>>;
}

export async function badgeOf(sw: Worker, tabId: number): Promise<string> {
  return sw.evaluate((id) => chrome.action.getBadgeText({ tabId: id }), tabId);
}

/** Waits until every frame of the page reports the given state (test builds set data-lekho-test). */
export async function waitForState(page: Page, state: 'on' | 'off'): Promise<void> {
  await page.waitForFunction((s) => document.documentElement.dataset.lekhoTest === s, state);
}
