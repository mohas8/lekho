/**
 * The release package itself: unzip release/lekho-<version>.zip into a clean
 * profile and use it the way a user does. The production build has no test
 * hooks and no host permissions, so page access comes only from the real
 * activeTab grant.
 *
 * The toolbar click is made with the DevTools command Extensions.triggerAction,
 * which runs the extension's action on a tab exactly like clicking its icon.
 * (Headless Chromium doesn't route keyboard shortcuts to extension commands.)
 */
import { test as base, chromium, expect, type BrowserContext, type CDPSession, type Page, type Worker } from '@playwright/test';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { FIXTURES } from './fixtures';

const root = resolve(import.meta.dirname, '../..');

function unzipTo(zipPath: string, dir: string): void {
  const buf = readFileSync(zipPath);
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  let p = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < buf.readUInt16LE(eocd + 10); i++) {
    const csize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const skip = buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString('utf8');
    const start = localOff + 30 + buf.readUInt16LE(localOff + 26) + buf.readUInt16LE(localOff + 28);
    const out = join(dir, name);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, inflateRawSync(buf.subarray(start, start + csize)));
    p += 46 + nameLen + skip;
  }
}

interface Env {
  context: BrowserContext;
  sw: Worker;
  browserCdp: CDPSession;
}

const test = base.extend<Env>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const zips = readdirSync(join(root, 'release')).filter((f) => /^lekho-.*\.zip$/.test(f));
    if (zips.length === 0) throw new Error('No release zip: run npm run package first');
    const extDir = mkdtempSync(join(tmpdir(), 'lekho-release-'));
    const profile = mkdtempSync(join(tmpdir(), 'lekho-profile-'));
    unzipTo(join(root, 'release', zips.sort().at(-1)!), extDir);
    const context = await chromium.launchPersistentContext(profile, {
      channel: 'chromium',
      headless: !process.env.HEADED,
      args: [`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`],
    });
    await use(context);
    await context.close();
    rmSync(extDir, { recursive: true, force: true });
    rmSync(profile, { recursive: true, force: true });
  },
  sw: async ({ context }, use) => {
    await use(context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker')));
  },
  browserCdp: async ({ context }, use) => {
    const browser = context.browser();
    if (!browser) throw new Error('no browser');
    await use(await browser.newBrowserCDPSession());
  },
});

/** Clicks the Lekho toolbar icon for the tab showing `page`. */
async function clickIcon(cdp: CDPSession, sw: Worker, page: Page): Promise<void> {
  const { targetInfos } = (await cdp.send('Target.getTargets', { filter: [{ type: 'tab' }] })) as {
    targetInfos: Array<{ type: string; url: string; targetId: string }>;
  };
  const tab = targetInfos.find((t) => t.type === 'tab' && t.url === page.url());
  if (!tab) throw new Error(`no tab target for ${page.url()}`);
  const extensionId = new URL(sw.url()).host;
  await cdp.send('Extensions.triggerAction' as 'Target.getTargets', { id: extensionId, targetId: tab.targetId } as never);
}

async function badge(sw: Worker, page: Page): Promise<string> {
  await page.bringToFront();
  return sw.evaluate(async (url) => {
    // Without host access, tab URLs are hidden except after a click; fall back to the active tab.
    const all = await chrome.tabs.query({});
    const tab = all.find((t) => t.url === url) ?? (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0];
    return tab?.id === undefined ? '?' : chrome.action.getBadgeText({ tabId: tab.id });
  }, page.url());
}

test('release zip: no warnings-level permissions, no test hooks', async ({ sw }) => {
  const manifest = await sw.evaluate(() => chrome.runtime.getManifest());
  expect(manifest.permissions).toEqual(['activeTab', 'scripting', 'storage']);
  expect(manifest.host_permissions).toBeUndefined();
  expect(manifest.content_scripts).toBeUndefined();
  expect(manifest.name).not.toMatch(/test/i);
  expect(await sw.evaluate(() => '__lekhoTest' in globalThis)).toBe(false);
  // The shortcut is registered for users (headless Chromium can't press browser shortcuts).
  const commands = await sw.evaluate(() => chrome.commands.getAll());
  expect(commands.find((c) => c.name === 'toggle-bangla')?.shortcut).toBe('Ctrl+Shift+Space');
});

test('release zip: icon click turns Bangla on; typing and suggestions work', async ({ context, sw, browserCdp }) => {
  const page = await context.newPage();
  await page.goto(`${FIXTURES}/page.html`);
  const input = page.locator('#text');
  await input.click();
  // No access before the click: typing stays English and nothing was injected.
  await page.keyboard.type('ami ');
  await expect(input).toHaveValue('ami ');
  expect(await page.locator('lekho-suggestions').count()).toBe(0);

  await clickIcon(browserCdp, sw, page);
  await expect.poll(() => badge(sw, page)).toBe('বাং');

  await input.click();
  await page.keyboard.press('End');
  await page.keyboard.type('korrmo kori ');
  await expect(input).toHaveValue('ami কর্ম করি ');

  // Suggestions from the packaged dictionary. The popup's shadow root is closed in
  // production, so check the effect: the second candidate for "kormo" is কর্ম.
  await page.keyboard.type('kormo');
  await page.waitForTimeout(500);
  await page.keyboard.press('ArrowDown');
  await expect(input).toHaveValue('ami কর্ম করি কর্ম');
  await page.keyboard.press(' ');
  await expect(input).toHaveValue('ami কর্ম করি কর্ম ');
  expect(await page.evaluate(() => document.querySelector('lekho-suggestions')?.shadowRoot ?? null)).toBeNull();

  // Click again: back to English.
  await clickIcon(browserCdp, sw, page);
  await expect.poll(() => badge(sw, page)).toBe('EN');
  await input.click();
  await page.keyboard.press('End');
  await page.keyboard.type('ok');
  await expect(input).toHaveValue('ami কর্ম করি কর্ম ok');
});

test('release zip: rich editor (Lexical) with the real grant', async ({ context, sw, browserCdp }) => {
  const page = await context.newPage();
  await page.goto(`${FIXTURES}/editors.html`);
  await page.waitForSelector('body[data-ready="true"]');
  await clickIcon(browserCdp, sw, page);
  await expect.poll(() => badge(sw, page)).toBe('বাং');
  await page.locator('#lexical').click();
  await page.keyboard.type('amar sOnar bangla ');
  await expect(page.locator('#lexical')).toHaveAttribute('data-doc', 'আমার সোনার বাংলা ');
});

test('release zip: a chrome:// page shows the "!" badge', async ({ context, sw, browserCdp }) => {
  const page = await context.newPage();
  await page.goto('chrome://version/');
  await clickIcon(browserCdp, sw, page);
  await expect.poll(() => badge(sw, page)).toBe('!');
});
