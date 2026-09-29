import { test as base, chromium, type BrowserContext, type Worker } from '@playwright/test';
import { resolve } from 'node:path';

export const FIXTURES = 'http://localhost:4173';
export const EXTENSION_DIR = resolve(import.meta.dirname, '../../dist-test');

type Fixtures = {
  context: BrowserContext;
  serviceWorker: Worker;
  extensionId: string;
};

/**
 * Launches Chromium with the test build of the extension loaded unpacked.
 * Extensions need a persistent context; channel "chromium" enables the new
 * headless mode, which supports extensions.
 */
export const test = base.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: !process.env.HEADED,
      args: [`--disable-extensions-except=${EXTENSION_DIR}`, `--load-extension=${EXTENSION_DIR}`],
    });
    await use(context);
    await context.close();
  },
  serviceWorker: async ({ context }, use) => {
    let [sw] = context.serviceWorkers();
    if (!sw) sw = await context.waitForEvent('serviceworker');
    await use(sw);
  },
  extensionId: async ({ serviceWorker }, use) => {
    await use(new URL(serviceWorker.url()).host);
  },
});

export const expect = test.expect;
