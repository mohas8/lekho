/** The website (site/): content, the in-page playground, and accessibility. */
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const SITE = 'http://localhost:4174/lekho/';
const AXE = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');

async function open(page: Page): Promise<void> {
  await page.goto(SITE);
  await page.waitForSelector('body[data-ready="true"]');
}

test('page content, credits and links', async ({ page }) => {
  await open(page);
  await expect(page).toHaveTitle('Lekho — Ridmik Bangla Phonetic Keyboard for Chrome');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Type Bangla on any website');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://www.mobashir.dev/lekho');
  const footer = page.getByRole('contentinfo');
  await expect(footer).toContainText('Md Mobashir Hasan');
  await expect(footer.getByRole('link', { name: 'LinkedIn' })).toHaveAttribute('href', 'https://www.linkedin.com/in/mohas8');
  await expect(page.getByRole('link', { name: 'Download the latest release' })).toHaveAttribute(
    'href',
    'https://github.com/mohas8/lekho/releases/latest',
  );
  await expect(page.getByRole('row', { name: /Reph/ })).toContainText('korrmo');
  // Every image and asset loads.
  for (const img of await page.locator('img').all()) {
    await img.scrollIntoViewIfNeeded();
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  }
});

test('playground: Ridmik typing, suggestions and the on/off switch', async ({ page }) => {
  await open(page);
  const pad = page.getByLabel('Playground: type phonetically to get Bangla');
  await pad.click();
  await page.keyboard.type('ami korrmo kori ');
  await expect(pad).toHaveValue('আমি কর্ম করি ');

  // Suggestions from the dictionary, loaded from the site.
  await page.keyboard.type('kormo');
  await page.waitForFunction(() => document.querySelectorAll('lekho-suggestions').length > 0);
  await page.waitForTimeout(600);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press(' ');
  await expect(pad).toHaveValue('আমি কর্ম করি কর্ম ');

  // Off: English as typed.
  await page.getByRole('button', { name: 'বাংলা' }).click();
  await expect(page.getByRole('status')).toHaveText('Bangla typing is off');
  await page.keyboard.type('ok');
  await expect(pad).toHaveValue('আমি কর্ম করি কর্ম ok');

  // The extension's shortcut switches it back on.
  await page.keyboard.press('Control+Shift+Space');
  await expect(page.getByRole('status')).toHaveText('Bangla typing is on');
  await page.keyboard.type(' bangla');
  await expect(pad).toHaveValue('আমি কর্ম করি কর্ম ok বাংলা');

  await page.getByRole('button', { name: 'Clear' }).click();
  await expect(pad).toHaveValue('');
});

test('works on a phone-sized screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(390);
});

for (const scheme of ['light', 'dark'] as const) {
  test(`no accessibility violations (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await open(page);
    await page.evaluate(AXE);
    const violations = await page.evaluate(async () => {
      const axe = (window as unknown as { axe: { run: (c: unknown, o: unknown) => Promise<{ violations: Array<{ id: string; nodes: Array<{ target: unknown }> }> }> } }).axe;
      const r = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } });
      return r.violations.map((v) => `${v.id}: ${JSON.stringify(v.nodes.map((n) => n.target))}`);
    });
    expect(violations).toEqual([]);
  });
}
