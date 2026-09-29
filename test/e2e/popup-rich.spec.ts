/**
 * Suggestion popup in rich editors, accessibility checks, and learned choices.
 */
import { createRequire } from 'node:module';
import { test, expect, FIXTURES } from './fixtures';
import { hook, tabIdOf, waitForState } from './helpers';
import type { BrowserContext, Page, Worker } from '@playwright/test';

const require = createRequire(import.meta.url);
const AXE_PATH = require.resolve('axe-core/axe.min.js');

async function openEnabled(context: BrowserContext, sw: Worker, path: string, ready?: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`${FIXTURES}/${path}`);
  if (ready) await page.waitForSelector(ready);
  const tabId = await tabIdOf(sw, page);
  expect(await hook(sw, 'enable', tabId)).toBe('on');
  await waitForState(page, 'on');
  return page;
}

const popup = (page: Page) => page.locator('lekho-suggestions [role="listbox"]');
const selected = (page: Page) => page.locator('lekho-suggestions [role="option"][aria-selected="true"]');
const option = (page: Page, word: string) =>
  page.locator('lekho-suggestions [role="option"]').filter({ has: page.getByText(word, { exact: true }) });
const status = (page: Page) => page.locator('lekho-suggestions [role="status"]');

async function typeWord(page: Page, text: string, dictionaryWord: string): Promise<void> {
  await page.keyboard.type(text);
  await expect(option(page, dictionaryWord)).toHaveCount(1);
}

/** Rectangle of the last `n` characters before the caret in a contenteditable. */
async function wordRect(page: Page, n: number) {
  return page.evaluate((len) => {
    const sel = document.getSelection()!;
    const node = sel.focusNode!;
    const r = document.createRange();
    r.setStart(node, Math.max(0, sel.focusOffset - len));
    r.setEnd(node, sel.focusOffset);
    const b = r.getBoundingClientRect();
    return { left: b.left, bottom: b.bottom, top: b.top };
  }, n);
}

test.describe('popup in rich editors', () => {
  test('contenteditable: shown right under the word; ArrowDown + Space picks', async ({ context, serviceWorker: sw }) => {
    const page = await openEnabled(context, sw, 'rich.html');
    const ce = page.locator('#ce');
    await ce.click();
    await page.keyboard.type('ami ');
    await typeWord(page, 'kormo', 'কর্ম');

    const word = await wordRect(page, 'করম'.length);
    const box = (await popup(page).boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(word.bottom);
    expect(box.y - word.bottom).toBeLessThan(20);
    expect(Math.abs(box.x - word.left)).toBeLessThan(20);

    await page.keyboard.press('ArrowDown');
    await expect(ce).toHaveText('আমি কর্ম');
    await page.keyboard.press(' ');
    await expect(ce).toHaveText('আমি কর্ম ');
    await expect(popup(page)).toBeHidden();
  });

  test('model editor (cancels beforeinput): picking updates its model', async ({ context, serviceWorker: sw }) => {
    const page = await openEnabled(context, sw, 'rich.html');
    await page.locator('#model').click();
    await typeWord(page, 'kormo', 'কর্ম');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press(' ');
    await expect(page.locator('#model')).toHaveAttribute('data-model', 'কর্ম ');
  });

  for (const [name, selector] of [
    ['Lexical', '#lexical'],
    ['ProseMirror', '#pm'],
    ['Quill', '#quill'],
  ] as const) {
    test(`${name}: picking a candidate updates the editor model`, async ({ context, serviceWorker: sw }) => {
      const page = await openEnabled(context, sw, 'editors.html', 'body[data-ready="true"]');
      await page.locator(selector).click();
      await typeWord(page, 'kormo', 'কর্ম');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press(' ');
      await page.keyboard.type('kori');
      await page.keyboard.press(' ');
      await expect(page.locator(selector)).toHaveAttribute('data-doc', 'কর্ম করি ');
    });
  }

  test('follows the word when the page scrolls', async ({ context, serviceWorker: sw }) => {
    const page = await openEnabled(context, sw, 'rich.html');
    await page.evaluate(() => {
      document.body.style.paddingBottom = '3000px';
    });
    await page.locator('#ce').click();
    await typeWord(page, 'kormo', 'কর্ম');
    const before = (await popup(page).boundingBox())!;
    await page.evaluate(() => window.scrollBy(0, 60));
    await expect.poll(async () => Math.round((await popup(page).boundingBox())!.y)).toBe(Math.round(before.y - 60));
  });

  test('shadow DOM editor gets the popup too', async ({ context, serviceWorker: sw }) => {
    const page = await openEnabled(context, sw, 'rich.html');
    await page.locator('#shadow-ce').click();
    await typeWord(page, 'kormo', 'কর্ম');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press(' ');
    await expect(page.locator('#shadow-ce')).toHaveText('কর্ম ');
  });
});

test.describe('accessibility', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`popup has no axe violations (${scheme})`, async ({ context, serviceWorker: sw }) => {
      const page = await openEnabled(context, sw, 'page.html');
      await page.emulateMedia({ colorScheme: scheme });
      await page.locator('#text').click();
      await typeWord(page, 'kormo', 'কর্ম');
      await page.keyboard.press('ArrowDown');
      await page.addScriptTag({ path: AXE_PATH });
      const violations = await page.evaluate(async () => {
        const axe = (window as unknown as { axe: { run: (ctx: unknown, opts: unknown) => Promise<{ violations: Array<{ id: string; nodes: unknown[] }> }> } }).axe;
        const host = document.querySelector('lekho-suggestions');
        const result = await axe.run(host, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } });
        return result.violations.map((v) => `${v.id} (${v.nodes.length})`);
      });
      expect(violations).toEqual([]);
    });
  }

  test('the list is labelled and announces the highlighted candidate', async ({ context, serviceWorker: sw }) => {
    const page = await openEnabled(context, sw, 'page.html');
    await page.locator('#text').click();
    await typeWord(page, 'kormo', 'কর্ম');
    await expect(popup(page)).toHaveAttribute('aria-label', 'Bangla suggestions');
    await expect(page.locator('lekho-suggestions [role="option"]').first()).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowDown');
    const count = await page.locator('lekho-suggestions [role="option"]').count();
    await expect(status(page)).toHaveText(`কর্ম, 2 of ${count}`);
    await expect(status(page)).toHaveAttribute('aria-live', 'polite');
    await expect(popup(page)).toHaveAttribute('aria-activedescendant', /opt-1$/);
  });

  test("text follows the user's default font size, not the page's", async ({ context, serviceWorker: sw }) => {
    const page = await openEnabled(context, sw, 'page.html');
    // A page that shrinks its own text must not shrink the popup.
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '10px';
      document.body.style.fontSize = '10px';
    });
    await page.locator('#text').click();
    await typeWord(page, 'kormo', 'কর্ম');
    const popupSize = await option(page, 'কর্ম').evaluate((li) => parseFloat(getComputedStyle(li).fontSize));
    // `medium` is the size chosen in Chrome's settings (16px by default).
    const userDefault = await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.style.cssText = 'all: initial; font-size: medium';
      document.documentElement.append(probe);
      const px = parseFloat(getComputedStyle(probe).fontSize);
      probe.remove();
      return px;
    });
    expect(popupSize).toBe(userDefault);
  });
});

test.describe('learned choices', () => {
  test('a picked candidate is highlighted by default next time', async ({ context, serviceWorker: sw }) => {
    const page = await openEnabled(context, sw, 'page.html');
    const input = page.locator('#text');
    await input.click();
    await typeWord(page, 'kormo', 'কর্ম');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press(' ');

    await typeWord(page, 'kormo', 'কর্ম');
    await expect(selected(page)).toHaveText('2কর্ম');
    await expect(input).toHaveValue('কর্ম কর্ম');
    await page.keyboard.press(' ');
    await expect(input).toHaveValue('কর্ম কর্ম ');

    // Stored only locally.
    const stored = await sw.evaluate(() => chrome.storage.local.get('learned'));
    expect(stored.learned).toEqual([['kormo', 'কর্ম']]);
  });

  test('going back to the Ridmik output forgets the choice', async ({ context, serviceWorker: sw }) => {
    const page = await openEnabled(context, sw, 'page.html');
    const input = page.locator('#text');
    await input.click();
    await typeWord(page, 'kormo', 'কর্ম');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press(' ');
    await typeWord(page, 'kormo', 'কর্ম');
    await expect(selected(page)).toHaveText('2কর্ম');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press(' ');
    await expect(input).toHaveValue('কর্ম করম ');

    await expect.poll(async () => (await sw.evaluate(() => chrome.storage.local.get('learned'))).learned).toEqual([]);
    await typeWord(page, 'kormo', 'কর্ম');
    await expect(selected(page)).toHaveText('1করম');
  });

  test('Enter keeps its normal job with a remembered choice', async ({ context, serviceWorker: sw }) => {
    const page = await openEnabled(context, sw, 'page.html');
    const area = page.locator('#area');
    await area.click();
    await typeWord(page, 'kormo', 'কর্ম');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press(' ');
    await typeWord(page, 'kormo', 'কর্ম');
    await page.keyboard.press('Enter');
    await expect(area).toHaveValue('কর্ম কর্ম\n');
  });

  test('a choice for a word carries over to it with a suffix', async ({ context, serviceWorker: sw }) => {
    const page = await openEnabled(context, sw, 'page.html');
    const input = page.locator('#text');
    await input.click();
    await typeWord(page, 'kormo', 'কর্ম');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press(' ');
    await typeWord(page, 'kormoke', 'কর্মকে');
    await expect(selected(page)).toHaveText(/কর্মকে$/);
  });
});
