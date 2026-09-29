/**
 * Hardening: Google Docs-style editors, focus changes in shadow DOM, page key
 * handlers, and typing speed.
 */
import { test, expect, FIXTURES } from './fixtures';
import { hook, tabIdOf, waitForState } from './helpers';
import type { BrowserContext, Page, Worker } from '@playwright/test';

async function openEnabled(context: BrowserContext, sw: Worker, path: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`${FIXTURES}/${path}`);
  const tabId = await tabIdOf(sw, page);
  expect(await hook(sw, 'enable', tabId)).toBe('on');
  await waitForState(page, 'on');
  return page;
}

const option = (page: Page, word: string) =>
  page.locator('lekho-suggestions [role="option"]').filter({ has: page.getByText(word, { exact: true }) });
const popup = (page: Page) => page.locator('lekho-suggestions [role="listbox"]');

test.describe('Google Docs-style editor (hidden input frame)', () => {
  async function openDocs(context: BrowserContext, sw: Worker): Promise<Page> {
    const page = await openEnabled(context, sw, 'docs.html');
    const frame = page.frameLocator('.docs-texteventtarget-iframe');
    await expect.poll(() => frame.locator('html').getAttribute('data-lekho-test')).toBe('on');
    await page.evaluate(() => (window as unknown as { focusDocsInput(): void }).focusDocsInput());
    return page;
  }

  test('words are previewed in the popup and inserted once when finished', async ({ context, serviceWorker: sw }) => {
    const page = await openDocs(context, sw);
    await page.keyboard.type('ami korrmo');
    // The unfinished word is only in the popup; the document has the finished one.
    await expect(page.locator('body')).toHaveAttribute('data-model', 'আমি ');
    await expect(popup(page)).toBeVisible();
    await expect(option(page, 'কর্ম')).toHaveCount(1);
    // The dari is written once the next key shows it isn't a decimal point.
    await page.keyboard.type(' kori. ');
    await expect(page.locator('body')).toHaveAttribute('data-model', 'আমি কর্ম করি। ');
  });

  test('picking a suggestion and backspacing inside a word', async ({ context, serviceWorker: sw }) => {
    const page = await openDocs(context, sw);
    await page.keyboard.type('kormo');
    await expect(option(page, 'কর্ম')).toHaveCount(1);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press(' ');
    await page.keyboard.type('bangla');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    await page.keyboard.type('ladesh');
    await page.keyboard.press('Enter');
    await expect(page.locator('body')).toHaveAttribute('data-model', 'কর্ম বাংলাদেশ\n');
    // Backspace with no word in progress reaches the document.
    await page.keyboard.press('Backspace');
    await expect(page.locator('body')).toHaveAttribute('data-model', 'কর্ম বাংলাদেশ');
  });

  test('the popup is placed at the visible caret', async ({ context, serviceWorker: sw }) => {
    const page = await openDocs(context, sw);
    await page.keyboard.type('ami ');
    await page.keyboard.type('kormo');
    await expect(option(page, 'কর্ম')).toHaveCount(1);
    const caret = (await page.locator('.kix-cursor-caret').boundingBox())!;
    const box = (await popup(page).boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(caret.y + caret.height - 1);
    expect(box.y - (caret.y + caret.height)).toBeLessThan(20);
    expect(Math.abs(box.x - caret.x)).toBeLessThan(20);
  });

  test('clicking in the document finishes the word', async ({ context, serviceWorker: sw }) => {
    const page = await openDocs(context, sw);
    await page.keyboard.type('ami');
    await page.locator('h1').click();
    await expect(page.locator('body')).toHaveAttribute('data-model', 'আমি');
    await expect(popup(page)).toBeHidden();
  });

  test('works with suggestions turned off (preview only)', async ({ context, serviceWorker: sw }) => {
    await sw.evaluate(() => chrome.storage.local.set({ settings: { version: 1, suggestions: false } }));
    const page = await openDocs(context, sw);
    await page.keyboard.type('korrmo');
    await expect(popup(page)).toBeVisible();
    await expect(page.locator('lekho-suggestions [role="option"]').first()).toHaveText('1কর্ম');
    await page.keyboard.type(' ');
    await expect(page.locator('body')).toHaveAttribute('data-model', 'কর্ম ');
  });
});

test.describe('focus and page handlers', () => {
  test('moving focus between shadow DOM fields mid-word finishes the word in the first one', async ({ context, serviceWorker: sw }) => {
    const page = await openEnabled(context, sw, 'rich.html');
    await page.locator('#shadow-input').click();
    await page.keyboard.type('ami');
    await page.keyboard.press('Tab'); // focus moves to the shadow contenteditable
    await page.keyboard.type('tumi');
    await expect(page.locator('#shadow-input')).toHaveValue('আমি');
    await expect(page.locator('#shadow-ce')).toHaveText('তুমি');
  });

  test('a field replaced by the page mid-word does not receive stale text', async ({ context, serviceWorker: sw }) => {
    const page = await openEnabled(context, sw, 'page.html');
    await page.locator('#text').click();
    await page.keyboard.type('ami');
    await page.evaluate(() => {
      const old = document.querySelector('#text')!;
      const fresh = document.createElement('input');
      fresh.id = 'text';
      old.replaceWith(fresh);
      fresh.focus();
    });
    await page.keyboard.type('ka');
    await expect(page.locator('#text')).toHaveValue('কা');
  });

  test('page shortcut handlers never see the letters Lekho converts', async ({ context, serviceWorker: sw }) => {
    const page = await openEnabled(context, sw, 'page.html');
    await page.evaluate(() => {
      const w = window as unknown as { __seen: string[] };
      w.__seen = [];
      for (const t of [document, document.body, document.querySelector('#area')!]) {
        t.addEventListener('keydown', (e) => w.__seen.push((e as KeyboardEvent).key));
        t.addEventListener('keypress', (e) => w.__seen.push('press:' + (e as KeyboardEvent).key));
      }
    });
    await page.locator('#area').click();
    await page.keyboard.type('jk');
    await page.keyboard.press('Enter');
    const seen = await page.evaluate(() => (window as unknown as { __seen: string[] }).__seen);
    expect(seen.filter((k) => k === 'j' || k === 'k' || k === 'press:j' || k === 'press:k')).toEqual([]);
    expect(seen).toContain('Enter');
    await expect(page.locator('#area')).toHaveValue('জক\n');
  });

  test('a key the page cancels first is left alone', async ({ context, serviceWorker: sw }) => {
    const page = await context.newPage();
    // Registered before Lekho is turned on, on the same target and phase, so it runs first.
    await page.addInitScript(() => {
      window.addEventListener(
        'keydown',
        (e) => {
          if (e.key === 'q') e.preventDefault();
        },
        true,
      );
    });
    await page.goto(`${FIXTURES}/page.html`);
    const tabId = await tabIdOf(sw, page);
    await hook(sw, 'enable', tabId);
    await waitForState(page, 'on');
    await page.locator('#text').click();
    await page.keyboard.type('aqa');
    await expect(page.locator('#text')).toHaveValue('আআ');
  });
});

test.describe('performance', () => {
  test('500 words: Lekho adds under 2 ms per keystroke', async ({ context, serviceWorker: sw }) => {
    test.setTimeout(180_000);
    const page = await openEnabled(context, sw, 'page.html');
    const words = ['ami', 'tomake', 'bhalobashi', 'korrmo', 'kori', 'bangladesh', 'amader', 'sOnar', 'bangla', 'shadhinota'];
    const text = Array.from({ length: 500 }, (_, i) => words[i % words.length]).join(' ') + ' ';
    await page.locator('#area').click();
    await page.keyboard.type(text);
    const stats = await page.evaluate(() => {
      document.dispatchEvent(new Event('lekho:perf-request'));
      return JSON.parse(document.documentElement.dataset.lekhoPerf ?? '[]') as Array<{ total: number; edit: number }>;
    });
    const value = await page.locator('#area').inputValue();
    expect(value.split(' ').filter(Boolean)).toHaveLength(500);
    expect(stats.length).toBeGreaterThan(text.length * 0.9);

    const pct = (xs: number[], q: number) => {
      const s = [...xs].sort((a, b) => a - b);
      return s[Math.min(s.length - 1, Math.floor(q * s.length))] as number;
    };
    // "own": Lekho's processing (keys, conversion, checks, suggestion bookkeeping),
    // without the browser's text editing, which native typing pays too.
    const own = stats.map((s) => s.total - s.edit);
    const total = stats.map((s) => s.total);
    const summary =
      `keys=${stats.length} own: median=${pct(own, 0.5).toFixed(2)} p95=${pct(own, 0.95).toFixed(2)} ms; ` +
      `total incl. editing: median=${pct(total, 0.5).toFixed(2)} p95=${pct(total, 0.95).toFixed(2)} ms`;
    console.log(summary);
    expect(pct(own, 0.95), summary).toBeLessThan(2);
    expect(pct(own, 0.5), summary).toBeLessThan(0.5);
    expect(pct(total, 0.5), summary).toBeLessThan(2);
  });
});
