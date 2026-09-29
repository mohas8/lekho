/**
 * Rich editors, shadow DOM, iframes and React, with the real extension
 * injecting the content script on demand.
 */
import { test, expect, FIXTURES } from './fixtures';
import { hook, tabIdOf, waitForState } from './helpers';
import type { BrowserContext, Page, Worker } from '@playwright/test';

async function openEnabled(context: BrowserContext, sw: Worker, path: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`${FIXTURES}/${path}`);
  await page.waitForLoadState('load');
  const tabId = await tabIdOf(sw, page);
  expect(await hook(sw, 'enable', tabId)).toBe('on');
  await waitForState(page, 'on');
  return page;
}

test.describe('rich editors', () => {
  test('plain contenteditable: type, backspace, Enter', async ({ context, serviceWorker: sw }) => {
    const page = await openEnabled(context, sw, 'rich.html');
    const ce = page.locator('#ce');
    await ce.click();
    await page.keyboard.type('ami korrmo kori');
    await expect(ce).toHaveText('আমি কর্ম করি');

    await page.keyboard.press('Enter');
    await page.keyboard.type('bangla');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    await page.keyboard.type('ladesh');
    expect(await ce.evaluate((el) => (el as HTMLElement).innerText)).toBe('আমি কর্ম করি\nবাংলাদেশ');
  });

  test('typing after formatted text keeps the formatting intact', async ({ context, serviceWorker: sw }) => {
    const page = await openEnabled(context, sw, 'rich.html');
    const ce = page.locator('#ce-rich');
    await ce.click();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.type(' ami');
    await expect(ce).toHaveText('hello world আমি');
    await expect(ce.locator('b')).toHaveText(/^world/);
  });

  test('model-driven editor that cancels beforeinput (Lexical-style)', async ({ context, serviceWorker: sw }) => {
    const page = await openEnabled(context, sw, 'rich.html');
    const ed = page.locator('#model');
    await ed.click();
    await page.keyboard.type('ami tomake');
    await expect(ed).toHaveAttribute('data-model', 'আমি তমাকে');
    await page.keyboard.type(' bhalobashi');
    await page.keyboard.press('Backspace');
    await expect(ed).toHaveAttribute('data-model', 'আমি তমাকে ভালবাশ');
    await expect(ed).toHaveText('আমি তমাকে ভালবাশ');
  });

  test('backspacing a whole word in the model editor', async ({ context, serviceWorker: sw }) => {
    const page = await openEnabled(context, sw, 'rich.html');
    const ed = page.locator('#model');
    await ed.click();
    await page.keyboard.type('ami ka');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    await expect(ed).toHaveAttribute('data-model', 'আমি ');
  });

  test('input and contenteditable inside an open shadow root', async ({ context, serviceWorker: sw }) => {
    const page = await openEnabled(context, sw, 'rich.html');
    await page.locator('#shadow-input').click();
    await page.keyboard.type('ami');
    await expect(page.locator('#shadow-input')).toHaveValue('আমি');

    await page.locator('#shadow-ce').click();
    await page.keyboard.type('korrmo kori');
    await expect(page.locator('#shadow-ce')).toHaveText('কর্ম করি');
  });

  test('same-origin iframe editors', async ({ context, serviceWorker: sw }) => {
    const page = await openEnabled(context, sw, 'rich.html');
    const frame = page.frameLocator('#frame');
    await frame.locator('#frame-area').click();
    await page.keyboard.type('ami');
    await expect(frame.locator('#frame-area')).toHaveValue('আমি');
    await frame.locator('#frame-ce').click();
    await page.keyboard.type('tumi');
    await expect(frame.locator('#frame-ce')).toHaveText('তুমি');
  });

  test('srcdoc iframe in designMode', async ({ context, serviceWorker: sw }) => {
    const page = await openEnabled(context, sw, 'rich.html');
    const body = page.frameLocator('#srcdoc').locator('body');
    await body.click();
    await page.keyboard.type('bangla');
    await expect(body).toHaveText('বাংলা');
  });

  test('iframe added after turning on gets the script too', async ({ context, serviceWorker: sw }) => {
    const page = await openEnabled(context, sw, 'rich.html');
    await page.evaluate(() => (window as unknown as { addDynamicFrame(): void }).addDynamicFrame());
    const frame = page.frameLocator('#dynamic');
    const area = frame.locator('#frame-area');
    await expect(area).toBeVisible();
    await expect
      .poll(async () => frame.locator('html').getAttribute('data-lekho-test'), { timeout: 10_000 })
      .toBe('on');
    await area.click();
    await page.keyboard.type('ami');
    await expect(area).toHaveValue('আমি');
  });
});

test.describe('React', () => {
  test('controlled input state follows our edits', async ({ context, serviceWorker: sw }) => {
    const page = await openEnabled(context, sw, 'react.html');
    const input = page.locator('#react-input');
    await input.click();
    await page.keyboard.type('amar sOnar bangla');
    await expect(input).toHaveValue('আমার সোনার বাংলা');
    await expect(page.locator('#react-input-state')).toHaveText('আমার সোনার বাংলা');
    await page.keyboard.press('Backspace');
    await expect(page.locator('#react-input-state')).toHaveText('আমার সোনার বাংল');
  });

  test('contenteditable onInput state follows our edits', async ({ context, serviceWorker: sw }) => {
    const page = await openEnabled(context, sw, 'react.html');
    await page.locator('#react-ce').click();
    await page.keyboard.type('ami korrmo kori');
    await expect(page.locator('#react-ce')).toHaveText('আমি কর্ম করি');
    await expect(page.locator('#react-ce-state')).toHaveText('আমি কর্ম করি');
  });
});
