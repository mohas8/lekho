/** Options page and live settings. */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test, expect, FIXTURES } from './fixtures';
import { hook, tabIdOf, waitForState } from './helpers';
import type { BrowserContext, Page, Worker } from '@playwright/test';

const require = createRequire(import.meta.url);
const AXE_PATH = require.resolve('axe-core/axe.min.js');

async function openOptions(context: BrowserContext, extensionId: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await page.waitForSelector('body[data-ready="true"]');
  return page;
}

async function openEnabled(context: BrowserContext, sw: Worker): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`${FIXTURES}/page.html`);
  const tabId = await tabIdOf(sw, page);
  expect(await hook(sw, 'enable', tabId)).toBe('on');
  await waitForState(page, 'on');
  return page;
}

test.describe('options page', () => {
  test('shows the defaults, the shortcut and the Avro guide', async ({ context, extensionId }) => {
    const page = await openOptions(context, extensionId);
    for (const label of ['Show word suggestions', 'Remember my choices', 'Bangla digits', 'Full stop becomes দাঁড়ি (।)']) {
      await expect(page.getByLabel(label)).toBeChecked();
    }
    await expect(page.locator('#shortcut')).toHaveText('Ctrl+Shift+Space');
    await expect(page.getByRole('row', { name: /Reph/ })).toContainText('korrmo');
    await expect(page.getByRole('row', { name: /Reph/ })).toContainText('kormo');
    await expect(page.getByRole('button', { name: 'Clear learned words' })).toBeDisabled();
  });

  test('credits the author with working links', async ({ context, extensionId }) => {
    const page = await openOptions(context, extensionId);
    const footer = page.getByRole('contentinfo');
    await expect(footer).toContainText('Md Mobashir Hasan');
    for (const [name, href] of [
      ['Lekho', 'https://mobashir.dev/lekho'],
      ['mobashir.dev', 'https://mobashir.dev'],
      ['GitHub', 'https://github.com/mohas8'],
      ['LinkedIn', 'https://www.linkedin.com/in/mohas8'],
      ['github.com/mohas8/lekho', 'https://github.com/mohas8/lekho'],
    ] as const) {
      const link = footer.getByRole('link', { name, exact: true });
      await expect(link).toHaveAttribute('href', href);
      await expect(link).toHaveAttribute('rel', /noopener/);
    }
  });

  test('turning digits off applies to an open tab without reloading', async ({ context, serviceWorker: sw, extensionId }) => {
    const tab = await openEnabled(context, sw);
    const options = await openOptions(context, extensionId);
    await options.getByLabel('Bangla digits').uncheck();
    await expect(options.getByRole('status')).toHaveText('Saved.');

    await tab.bringToFront();
    await tab.locator('#text').click();
    await tab.keyboard.type('2026 sal');
    await expect(tab.locator('#text')).toHaveValue('2026 সাল');

    await options.bringToFront();
    await options.getByLabel('Bangla digits').check();
    await tab.bringToFront();
    await tab.locator('#text').click();
    await tab.keyboard.type(' 2026');
    await expect(tab.locator('#text')).toHaveValue('2026 সাল ২০২৬');
  });

  test('full stop setting', async ({ context, serviceWorker: sw, extensionId }) => {
    const tab = await openEnabled(context, sw);
    const options = await openOptions(context, extensionId);
    await options.getByLabel('Full stop becomes দাঁড়ি (।)').uncheck();
    await expect(options.getByRole('status')).toHaveText('Saved.');
    await tab.bringToFront();
    await tab.locator('#text').click();
    await tab.keyboard.type('ami.');
    await expect(tab.locator('#text')).toHaveValue('আমি.');
  });

  test('turning suggestions off hides the list; typing still converts', async ({ context, serviceWorker: sw, extensionId }) => {
    const tab = await openEnabled(context, sw);
    const options = await openOptions(context, extensionId);
    await options.getByLabel('Show word suggestions').uncheck();
    await expect(options.getByLabel('Remember my choices')).toBeDisabled();
    await expect(options.getByRole('status')).toHaveText('Saved.');

    await tab.bringToFront();
    await tab.locator('#text').click();
    await tab.keyboard.type('kormo');
    await expect(tab.locator('#text')).toHaveValue('করম');
    await tab.waitForTimeout(300);
    await expect(tab.locator('lekho-suggestions [role="listbox"]')).toBeHidden();
  });

  test('"Remember my choices" off: picks are not remembered', async ({ context, serviceWorker: sw, extensionId }) => {
    const options = await openOptions(context, extensionId);
    await options.getByLabel('Remember my choices').uncheck();
    await expect(options.getByRole('status')).toHaveText('Saved.');
    const tab = await openEnabled(context, sw);
    await tab.locator('#text').click();
    await tab.keyboard.type('kormo');
    await expect(tab.locator('lekho-suggestions [role="option"]').filter({ has: tab.getByText('কর্ম', { exact: true }) })).toHaveCount(1);
    await tab.keyboard.press('ArrowDown');
    await tab.keyboard.press(' ');
    await tab.waitForTimeout(300);
    const stored = await sw.evaluate(() => chrome.storage.local.get('learned'));
    expect(stored.learned ?? []).toEqual([]);
  });

  test('Clear learned words', async ({ context, serviceWorker: sw, extensionId }) => {
    await sw.evaluate(() => chrome.storage.local.set({ learned: [['kormo', 'কর্ম'], ['dhormo', 'ধর্ম']] }));
    const options = await openOptions(context, extensionId);
    await expect(options.locator('#learned-count')).toHaveText('2 remembered choices.');
    options.once('dialog', (d) => void d.accept());
    await options.getByRole('button', { name: 'Clear learned words' }).click();
    await expect(options.getByRole('status')).toHaveText('Learned words cleared.');
    await expect(options.locator('#learned-count')).toHaveText('No remembered choices yet.');
    expect((await sw.evaluate(() => chrome.storage.local.get('learned'))).learned).toEqual([]);

    // The worker forgets them too.
    const tab = await openEnabled(context, sw);
    await tab.locator('#text').click();
    await tab.keyboard.type('kormo');
    await expect(tab.locator('lekho-suggestions [role="option"][aria-selected="true"]')).toHaveText('1করম');
  });

  test('cancelling the confirmation keeps the learned words', async ({ context, serviceWorker: sw, extensionId }) => {
    await sw.evaluate(() => chrome.storage.local.set({ learned: [['kormo', 'কর্ম']] }));
    const options = await openOptions(context, extensionId);
    options.once('dialog', (d) => void d.dismiss());
    await options.getByRole('button', { name: 'Clear learned words' }).click();
    await expect(options.locator('#learned-count')).toHaveText('1 remembered choice.');
  });

  test('settings survive a reload of the options page', async ({ context, extensionId }) => {
    const options = await openOptions(context, extensionId);
    await options.getByLabel('Bangla digits').uncheck();
    await expect(options.getByRole('status')).toHaveText('Saved.');
    await options.reload();
    await options.waitForSelector('body[data-ready="true"]');
    await expect(options.getByLabel('Bangla digits')).not.toBeChecked();
    await expect(options.getByLabel('Show word suggestions')).toBeChecked();
  });

  test('keyboard only: Tab reaches every control, Space toggles', async ({ context, extensionId }) => {
    const options = await openOptions(context, extensionId);
    await options.keyboard.press('Tab');
    await expect(options.getByLabel('Show word suggestions')).toBeFocused();
    await options.keyboard.press('Tab');
    await expect(options.getByLabel('Remember my choices')).toBeFocused();
    await options.keyboard.press('Tab');
    await expect(options.getByLabel('Bangla digits')).toBeFocused();
    await options.keyboard.press(' ');
    await expect(options.getByLabel('Bangla digits')).not.toBeChecked();
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`options page has no axe violations (${scheme})`, async ({ context, extensionId }) => {
      const options = await openOptions(context, extensionId);
      await options.emulateMedia({ colorScheme: scheme });
      // Extension pages forbid inline scripts (CSP), so load axe through DevTools evaluation instead of a <script>.
      await options.evaluate(readFileSync(AXE_PATH, 'utf8'));
      const violations = await options.evaluate(async () => {
        const axe = (window as unknown as { axe: { run: (ctx: unknown, o: unknown) => Promise<{ violations: Array<{ id: string }> }> } }).axe;
        const r = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } });
        return r.violations.map((v) => v.id);
      });
      expect(violations).toEqual([]);
    });
  }
});
