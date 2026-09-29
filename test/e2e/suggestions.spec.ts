/**
 * Suggestion popup in plain fields, with the real extension and dictionary.
 * Test builds use an open shadow root, so locators can see inside the popup.
 */
import { test, expect, FIXTURES } from './fixtures';
import { hook, tabIdOf, waitForState } from './helpers';
import type { BrowserContext, Locator, Page, Worker } from '@playwright/test';

async function openEnabled(context: BrowserContext, sw: Worker, path = 'page.html'): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`${FIXTURES}/${path}`);
  const tabId = await tabIdOf(sw, page);
  expect(await hook(sw, 'enable', tabId)).toBe('on');
  await waitForState(page, 'on');
  return page;
}

const popup = (page: Page) => page.locator('lekho-suggestions [role="listbox"]');
const options = (page: Page) => page.locator('lekho-suggestions [role="option"]');
const selected = (page: Page) => page.locator('lekho-suggestions [role="option"][aria-selected="true"]');
/** The option whose word is exactly `word` (not just containing it). */
const option = (page: Page, word: string) => options(page).filter({ has: page.getByText(word, { exact: true }) });

/** Waits until the dictionary answer for the current word is shown. */
async function waitForDictionary(page: Page, word: string): Promise<void> {
  await expect(option(page, word)).toHaveCount(1);
}

async function typeAndWait(page: Page, field: Locator, text: string, expectWord: string): Promise<void> {
  await field.click();
  await page.keyboard.type(text);
  await waitForDictionary(page, expectWord);
}

test.describe('suggestion popup (plain fields)', () => {
  test('shows candidates with the Ridmik output first and highlighted', async ({ context, serviceWorker: sw }) => {
    const page = await openEnabled(context, sw);
    await typeAndWait(page, page.locator('#text'), 'kormo', 'কর্ম');
    await expect(popup(page)).toBeVisible();
    await expect(options(page).first()).toHaveText('1করম');
    await expect(selected(page)).toHaveText('1করম');
    await expect(options(page).last()).toHaveText(/kormo/);
    expect(await options(page).count()).toBeLessThanOrEqual(10);
    await expect(page.locator('#text')).toHaveValue('করম');
  });

  test('ArrowDown then Space picks the second candidate', async ({ context, serviceWorker: sw }) => {
    const page = await openEnabled(context, sw);
    await typeAndWait(page, page.locator('#text'), 'kormo', 'কর্ম');
    await page.keyboard.press('ArrowDown');
    await expect(selected(page)).toHaveText('2কর্ম');
    await page.keyboard.press(' ');
    await expect(page.locator('#text')).toHaveValue('কর্ম ');
    await expect(popup(page)).toBeHidden();
  });

  test('Space without moving keeps the Ridmik output', async ({ context, serviceWorker: sw }) => {
    const page = await openEnabled(context, sw);
    await typeAndWait(page, page.locator('#text'), 'kormo', 'কর্ম');
    await page.keyboard.type(' korrmo ');
    await expect(page.locator('#text')).toHaveValue('করম কর্ম ');
  });

  test('Enter picks without a newline only after moving the highlight', async ({ context, serviceWorker: sw }) => {
    const page = await openEnabled(context, sw);
    const area = page.locator('#area');
    await typeAndWait(page, area, 'kormo', 'কর্ম');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(area).toHaveValue('কর্ম');
    await page.keyboard.press('Enter');
    await expect(area).toHaveValue('কর্ম\n');

    await page.keyboard.type('dhormo');
    await waitForDictionary(page, 'ধর্ম');
    await page.keyboard.press('Enter');
    await expect(area).toHaveValue('কর্ম\nধরম\n');
  });

  test('Escape closes the list, keeps the text shown, and is not seen by the page', async ({ context, serviceWorker: sw }) => {
    const page = await openEnabled(context, sw);
    await page.evaluate(() => {
      (window as unknown as { __esc: number }).__esc = 0;
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') (window as unknown as { __esc: number }).__esc++;
      });
    });
    await typeAndWait(page, page.locator('#text'), 'kormo', 'কর্ম');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Escape');
    await expect(popup(page)).toBeHidden();
    await expect(page.locator('#text')).toHaveValue('কর্ম');
    expect(await page.evaluate(() => (window as unknown as { __esc: number }).__esc)).toBe(0);
    // With the list closed, Escape reaches the page again.
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => (window as unknown as { __esc: number }).__esc)).toBe(1);
  });

  test('the field always shows the highlighted candidate', async ({ context, serviceWorker: sw }) => {
    const page = await openEnabled(context, sw);
    const input = page.locator('#text');
    await typeAndWait(page, input, 'kormo', 'কর্ম');
    await page.keyboard.press('ArrowDown');
    await expect(input).toHaveValue('কর্ম');
    await page.keyboard.press('ArrowDown');
    await expect(input).toHaveValue('ক্রম');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await expect(input).toHaveValue('করম');
    // Typing on continues the English word and re-converts it.
    await page.keyboard.press('ArrowDown');
    await page.keyboard.type('k');
    await expect(input).toHaveValue('করমক');
  });

  test('clicking a candidate picks it and keeps focus in the field', async ({ context, serviceWorker: sw }) => {
    const page = await openEnabled(context, sw);
    const input = page.locator('#text');
    await typeAndWait(page, input, 'kormo', 'কর্ম');
    await option(page, 'কর্ম').click();
    await expect(input).toHaveValue('কর্ম');
    await expect(input).toBeFocused();
    await page.keyboard.type(' ami');
    await expect(input).toHaveValue('কর্ম আমি');
  });

  test('punctuation ends the word with the highlighted candidate', async ({ context, serviceWorker: sw }) => {
    const page = await openEnabled(context, sw);
    await typeAndWait(page, page.locator('#text'), 'kormo', 'কর্ম');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.type(',');
    await expect(page.locator('#text')).toHaveValue('কর্ম,');
  });

  test('the English candidate keeps the word as typed', async ({ context, serviceWorker: sw }) => {
    const page = await openEnabled(context, sw);
    await typeAndWait(page, page.locator('#text'), 'kormo', 'কর্ম');
    await page.keyboard.press('ArrowUp'); // wraps to the last item
    await expect(selected(page)).toHaveText(/kormo/);
    await page.keyboard.press(' ');
    await expect(page.locator('#text')).toHaveValue('kormo ');
  });

  test('suggestions include dictionary words with suffixes', async ({ context, serviceWorker: sw }) => {
    const page = await openEnabled(context, sw);
    await typeAndWait(page, page.locator('#text'), 'amader', 'আমাদের');
    await typeAndWait(page, page.locator('#text'), ' bhalobasa', 'ভালোবাসা');
  });

  test('the popup sits just below the word being typed', async ({ context, serviceWorker: sw }) => {
    const page = await openEnabled(context, sw);
    const area = page.locator('#area');
    await area.click();
    await page.keyboard.type('ami tomake onek ');
    await page.keyboard.type('kormo');
    await waitForDictionary(page, 'কর্ম');
    const box = (await area.boundingBox())!;
    const pop = (await popup(page).boundingBox())!;
    // Below the first line of the textarea, and indented to where the word starts.
    expect(pop.y).toBeGreaterThan(box.y + 10);
    expect(pop.y).toBeLessThan(box.y + box.height);
    expect(pop.x).toBeGreaterThan(box.x + 40);
  });

  test('no popup for digits, password fields, or when turned off', async ({ context, serviceWorker: sw }) => {
    const page = await openEnabled(context, sw);
    await page.locator('#text').click();
    await page.keyboard.type('2026');
    await expect(page.locator('#text')).toHaveValue('২০২৬');
    await expect(popup(page)).toBeHidden();

    await page.locator('#password').click();
    await page.keyboard.type('kormo');
    await expect(popup(page)).toBeHidden();

    await page.locator('#text').click();
    await page.keyboard.type(' kormo');
    await expect(popup(page)).toBeVisible();
    const tabId = await tabIdOf(sw, page);
    await hook(sw, 'disable', tabId);
    await waitForState(page, 'off');
    await expect(popup(page)).toBeHidden();
  });

  test('clicking elsewhere closes the popup and keeps the text', async ({ context, serviceWorker: sw }) => {
    const page = await openEnabled(context, sw);
    await typeAndWait(page, page.locator('#text'), 'kormo', 'কর্ম');
    await page.locator('h1').click();
    await expect(popup(page)).toBeHidden();
    await expect(page.locator('#text')).toHaveValue('করম');
  });
});
