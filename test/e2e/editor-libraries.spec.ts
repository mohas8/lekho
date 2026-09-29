/**
 * Real editor libraries (Lexical, ProseMirror, Quill). Each fixture mirrors
 * the editor's own document into data-doc, so these tests check that the
 * editor's model, not just the DOM, received our text.
 */
import { test, expect, FIXTURES } from './fixtures';
import { hook, tabIdOf, waitForState } from './helpers';
import type { BrowserContext, Page, Worker } from '@playwright/test';

async function openEditors(context: BrowserContext, sw: Worker): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`${FIXTURES}/editors.html`);
  await page.waitForSelector('body[data-ready="true"]');
  const tabId = await tabIdOf(sw, page);
  expect(await hook(sw, 'enable', tabId)).toBe('on');
  await waitForState(page, 'on');
  return page;
}

for (const [name, selector] of [
  ['Lexical', '#lexical'],
  ['ProseMirror', '#pm'],
  ['Quill', '#quill'],
] as const) {
  test.describe(name, () => {
    test('typing updates the editor model', async ({ context, serviceWorker: sw }) => {
      const page = await openEditors(context, sw);
      const ed = page.locator(selector);
      await ed.click();
      await page.keyboard.type('ami korrmo kori');
      await expect(ed).toHaveAttribute('data-doc', 'আমি কর্ম করি');
      await expect(ed).toHaveText('আমি কর্ম করি');
    });

    test('backspace mid-word and after a word', async ({ context, serviceWorker: sw }) => {
      const page = await openEditors(context, sw);
      const ed = page.locator(selector);
      await ed.click();
      await page.keyboard.type('bangla');
      await page.keyboard.press('Backspace');
      await page.keyboard.press('Backspace');
      await page.keyboard.type('ladesh ami');
      await expect(ed).toHaveAttribute('data-doc', 'বাংলাদেশ আমি');
      for (let i = 0; i < 3; i++) await page.keyboard.press('Backspace');
      await expect(ed).toHaveAttribute('data-doc', 'বাংলাদেশ ');
    });

    test('Enter starts a new paragraph', async ({ context, serviceWorker: sw }) => {
      const page = await openEditors(context, sw);
      const ed = page.locator(selector);
      await ed.click();
      await page.keyboard.type('ek');
      await page.keyboard.press('Enter');
      await page.keyboard.type('dui');
      await expect(ed).toHaveAttribute('data-doc', /^এক\n+দুই$/);
    });

    test('undo removes our text', async ({ context, serviceWorker: sw }) => {
      const page = await openEditors(context, sw);
      const ed = page.locator(selector);
      await ed.click();
      await page.keyboard.type('ami ');
      await page.keyboard.press('ControlOrMeta+z');
      await expect.poll(async () => (await ed.getAttribute('data-doc')) ?? '').not.toContain('আমি ');
    });
  });
}
