import { describe, expect, it } from 'vitest';
import { buildManifest } from '../../src/manifest';

describe('manifest', () => {
  it('production build requests no host permissions', () => {
    const m = buildManifest('production', '1.2.3');
    expect(m.name).toBe('Lekho — Ridmik Bangla Phonetic Keyboard');
    expect(m.name.length).toBeLessThanOrEqual(75); // Chrome's limit
    expect(m.description!.length).toBeLessThanOrEqual(132); // Web Store rejects longer descriptions
    expect(m.homepage_url).toBe('https://mobashir.dev/lekho');
    expect(m.version).toBe('1.2.3');
    expect(m.permissions).toEqual(['activeTab', 'scripting', 'storage']);
    expect(m.host_permissions).toBeUndefined();
    expect(m.content_scripts).toBeUndefined();
    expect(m.commands?.['toggle-bangla']?.suggested_key).toEqual({ default: 'Ctrl+Shift+Space' });
  });

  it('test build adds localhost access only', () => {
    expect(buildManifest('test', '0.0.1').host_permissions).toEqual(['http://localhost/*', 'http://127.0.0.1/*']);
  });
});
