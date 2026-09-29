/**
 * Typing into plain fields with the content script loaded directly by the
 * page (standalone test mode), independent of extension injection.
 */
import { test, expect, type Page } from '@playwright/test';
import { FIXTURES } from './fixtures';

async function open(page: Page): Promise<void> {
  await page.goto(`${FIXTURES}/plain.html`);
  await page.waitForFunction(() => window.__lekho?.isEnabled === true);
}

test.describe('plain fields', () => {
  test.beforeEach(async ({ page }) => open(page));

  test('text input converts live', async ({ page }) => {
    const input = page.locator('#text');
    await input.click();
    await page.keyboard.type('ami tomake bhalobashi');
    await expect(input).toHaveValue('আমি তমাকে ভালবাশি');
  });

  test('textarea converts, Enter adds a newline', async ({ page }) => {
    const area = page.locator('#area');
    await area.click();
    await page.keyboard.type('ami korrmo kori');
    await page.keyboard.press('Enter');
    await page.keyboard.type('amar sOnar bangla.');
    await expect(area).toHaveValue('আমি কর্ম করি\nআমার সোনার বাংলা।');
  });

  test('search input converts', async ({ page }) => {
    await page.locator('#search').click();
    await page.keyboard.type('bangladesh');
    await expect(page.locator('#search')).toHaveValue('বাংলাদেশ');
  });

  test('backspace mid-word removes English letters and re-converts', async ({ page }) => {
    const input = page.locator('#text');
    await input.click();
    await page.keyboard.type('bangla');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    await expect(input).toHaveValue('বাং');
    await page.keyboard.type('ladesh');
    await expect(input).toHaveValue('বাংলাদেশ');
  });

  test('backspace after a finished word deletes one character natively', async ({ page }) => {
    const input = page.locator('#text');
    await input.click();
    await page.keyboard.type('ami ');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    await expect(input).toHaveValue('আম');
  });

  test('a click mid-word finishes it; typing continues at the new caret', async ({ page }) => {
    const input = page.locator('#text');
    await input.click();
    await page.keyboard.type('ami');
    await input.click({ position: { x: 3, y: 5 } }); // caret to the start
    await page.keyboard.type('ka');
    await expect(input).toHaveValue('কাআমি');
  });

  test('arrow keys finish the word', async ({ page }) => {
    const input = page.locator('#text');
    await input.click();
    await page.keyboard.type('ami');
    await page.keyboard.press('Home');
    await page.keyboard.type('k');
    await expect(input).toHaveValue('কআমি');
  });

  test('digits and full stop follow the defaults', async ({ page }) => {
    const input = page.locator('#text');
    await input.click();
    await page.keyboard.type('2026 sal. 10.5 kg...');
    await expect(input).toHaveValue('২০২৬ সাল। ১০.৫ কগ...');
  });

  test('a change made by the page is never overwritten', async ({ page }) => {
    const input = page.locator('#text');
    await input.click();
    await page.keyboard.type('ami');
    await input.evaluate((el: HTMLInputElement) => {
      el.value += 'X';
    });
    await page.keyboard.type('k');
    await expect(input).toHaveValue('আমিXক');
  });

  test('shortcuts pass through: Ctrl+A then typing replaces the selection', async ({ page }) => {
    const input = page.locator('#text');
    await input.click();
    await page.keyboard.type('ami tumi');
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('o');
    await expect(input).toHaveValue('অ');
  });

  test('sensitive and read-only fields stay untouched', async ({ page }) => {
    for (const [id, text] of [
      ['#password', 'ami'],
      ['#email', 'ami@example.com'],
      ['#otp', '123456'],
      ['#shown-password', 'secret1'],
    ] as const) {
      await page.locator(id).click();
      await page.keyboard.type(text);
      await expect(page.locator(id)).toHaveValue(text);
    }
    await page.locator('#readonly').click();
    await page.keyboard.type('abc');
    await expect(page.locator('#readonly')).toHaveValue('fixed');
  });

  test('page keydown handlers do not see consumed keys, but input events fire', async ({ page }) => {
    const seen = await page.evaluate(() => {
      const w = window as unknown as { __keys: string[]; __inputs: number };
      w.__keys = [];
      w.__inputs = 0;
      const el = document.querySelector('#text')!;
      el.addEventListener('keydown', (e) => w.__keys.push((e as KeyboardEvent).key));
      el.addEventListener('input', () => w.__inputs++);
      return true;
    });
    expect(seen).toBe(true);
    await page.locator('#text').click();
    await page.keyboard.type('ab c');
    const { keys, inputs } = await page.evaluate(() => {
      const w = window as unknown as { __keys: string[]; __inputs: number };
      return { keys: w.__keys, inputs: w.__inputs };
    });
    expect(keys).toEqual([' ']);
    expect(inputs).toBe(4);
  });
});
