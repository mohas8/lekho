import { test, expect } from './fixtures';

test('extension loads and its service worker registers', async ({ serviceWorker, extensionId, context }) => {
  expect(serviceWorker.url()).toBe(`chrome-extension://${extensionId}/service-worker.js`);
  const manifest = await serviceWorker.evaluate(() => chrome.runtime.getManifest());
  expect(manifest.manifest_version).toBe(3);
  expect(manifest.permissions).toEqual(['activeTab', 'scripting', 'storage']);
  expect(manifest.commands?.['toggle-bangla']).toBeTruthy();

  // Options page is reachable.
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Lekho');
});
