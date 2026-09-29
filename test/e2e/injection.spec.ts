import { test, expect, FIXTURES } from './fixtures';
import { badgeOf, hook, tabIdOf, waitForState } from './helpers';

test.describe('extension injection', () => {
  test('toggle on, type Bangla, toggle off, type English', async ({ context, serviceWorker: sw }) => {
    const page = await context.newPage();
    await page.goto(`${FIXTURES}/page.html`);
    const tabId = await tabIdOf(sw, page);

    expect(await hook(sw, 'toggle', tabId)).toBe('on');
    await waitForState(page, 'on');
    expect(await badgeOf(sw, tabId)).toBe('বাং');

    const input = page.locator('#text');
    await input.click();
    await page.keyboard.type('ami korrmo kori');
    await expect(input).toHaveValue('আমি কর্ম করি');

    expect(await hook(sw, 'toggle', tabId)).toBe('off');
    await waitForState(page, 'off');
    expect(await badgeOf(sw, tabId)).toBe('EN');
    await page.keyboard.type(' ok');
    await expect(input).toHaveValue('আমি কর্ম করি ok');

    // On again: the existing script is re-synced, not duplicated.
    expect(await hook(sw, 'toggle', tabId)).toBe('on');
    await waitForState(page, 'on');
    await page.keyboard.type(' ami');
    await expect(input).toHaveValue('আমি কর্ম করি ok আমি');
  });

  test('stays on after a reload', async ({ context, serviceWorker: sw }) => {
    const page = await context.newPage();
    await page.goto(`${FIXTURES}/page.html`);
    const tabId = await tabIdOf(sw, page);
    await hook(sw, 'enable', tabId);
    await waitForState(page, 'on');

    await page.reload();
    await waitForState(page, 'on');
    expect(await badgeOf(sw, tabId)).toBe('বাং');
    await page.locator('#area').click();
    await page.keyboard.type('bangla');
    await expect(page.locator('#area')).toHaveValue('বাংলা');
  });

  test('turned-off state is forgotten after a reload', async ({ context, serviceWorker: sw }) => {
    const page = await context.newPage();
    await page.goto(`${FIXTURES}/page.html`);
    const tabId = await tabIdOf(sw, page);
    await hook(sw, 'enable', tabId);
    await waitForState(page, 'on');
    await hook(sw, 'disable', tabId);
    await waitForState(page, 'off');

    await page.reload();
    await expect.poll(() => hook(sw, 'status', tabId)).toBeUndefined();
    expect(await badgeOf(sw, tabId)).toBe('');
    await page.locator('#text').click();
    await page.keyboard.type('ami');
    await expect(page.locator('#text')).toHaveValue('ami');
  });

  test('password fields stay English while on', async ({ context, serviceWorker: sw }) => {
    const page = await context.newPage();
    await page.goto(`${FIXTURES}/page.html`);
    const tabId = await tabIdOf(sw, page);
    await hook(sw, 'enable', tabId);
    await waitForState(page, 'on');
    await page.locator('#password').click();
    await page.keyboard.type('ami123');
    await expect(page.locator('#password')).toHaveValue('ami123');
  });

  test('tabs are independent', async ({ context, serviceWorker: sw }) => {
    const a = await context.newPage();
    await a.goto(`${FIXTURES}/page.html?a`);
    const b = await context.newPage();
    await b.goto(`${FIXTURES}/page.html?b`);
    const idA = await tabIdOf(sw, a);
    await hook(sw, 'enable', idA);
    await waitForState(a, 'on');

    await b.bringToFront();
    await b.locator('#text').click();
    await b.keyboard.type('ami');
    await expect(b.locator('#text')).toHaveValue('ami');
    expect(await badgeOf(sw, await tabIdOf(sw, b))).toBe('');
  });

  test('protected pages show the "!" badge', async ({ context, serviceWorker: sw }) => {
    const page = await context.newPage();
    await page.goto('chrome://version/');
    const tabId = await tabIdOf(sw, page);
    expect(await hook(sw, 'toggle', tabId)).toBe('blocked');
    expect(await badgeOf(sw, tabId)).toBe('!');
    const title = await sw.evaluate((id) => chrome.action.getTitle({ tabId: id }), tabId);
    expect(title).toContain("can't type on this page");
  });
});
