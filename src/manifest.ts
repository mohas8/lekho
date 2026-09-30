/**
 * Generates manifest.json for a build mode.
 *
 * Production builds request only activeTab + scripting + storage: the extension
 * gets access to a tab only when the user clicks the toolbar icon or presses the
 * shortcut, so installation shows no host-permission warning.
 *
 * Test builds (dist-test/) additionally get localhost host permissions so
 * Playwright can inject without a real toolbar click.
 */
export type BuildMode = 'production' | 'test';

export const TOGGLE_COMMAND = 'toggle-bangla';

export const PRODUCT_NAME = 'Lekho — Ridmik Bangla Phonetic Keyboard';
/** mobashir.dev is on the HSTS preload list (.dev TLD), so browsers always use https. */
export const HOMEPAGE_URL = 'https://mobashir.dev/lekho';

export const AUTHOR = {
  name: 'Md Mobashir Hasan',
  website: 'https://mobashir.dev',
  github: 'https://github.com/mohas8',
  linkedin: 'https://www.linkedin.com/in/mohas8',
} as const;

const icons = {
  '16': 'icons/icon16.png',
  '32': 'icons/icon32.png',
  '48': 'icons/icon48.png',
  '128': 'icons/icon128.png',
};

export function buildManifest(mode: BuildMode, version: string): chrome.runtime.ManifestV3 {
  const manifest: chrome.runtime.ManifestV3 = {
    manifest_version: 3,
    name: mode === 'test' ? 'Lekho (test build)' : PRODUCT_NAME,
    short_name: 'Lekho',
    version,
    // Chrome links the extension's name at the top of the toolbar icon's right-click menu to this page.
    homepage_url: HOMEPAGE_URL,
    description:
      'Type Bangla on any web page with Ridmik-style phonetic rules and word suggestions. Offline; nothing you type leaves your device.',
    minimum_chrome_version: '120',
    permissions: ['activeTab', 'scripting', 'storage'],
    background: { service_worker: 'service-worker.js' },
    action: {
      default_title: 'Lekho: turn Bangla typing on/off for this tab',
      default_icon: icons,
    },
    icons,
    commands: {
      [TOGGLE_COMMAND]: {
        suggested_key: { default: 'Ctrl+Shift+Space' },
        description: 'Turn Bangla typing on/off for this tab',
      },
    },
    options_ui: { page: 'options.html', open_in_tab: true },
  };
  if (mode === 'test') {
    manifest.host_permissions = ['http://localhost/*', 'http://127.0.0.1/*'];
  }
  return manifest;
}
