import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  normalizeSettings,
  saveSettings,
  SETTINGS_KEY,
  SETTINGS_VERSION,
  type SettingsArea,
} from '../../src/shared/settings';
import { GUIDE } from '../../src/options/guide';
import { convertLetters } from '../../src/engine/ridmik';

function memoryArea(initial: Record<string, unknown> = {}): SettingsArea & { data: Record<string, unknown> } {
  const data = structuredClone(initial);
  return {
    data,
    async get(key) {
      return key in data ? { [key]: structuredClone(data[key]) } : {};
    },
    async set(items) {
      Object.assign(data, structuredClone(items));
    },
  };
}

describe('settings', () => {
  it('defaults: everything on', () => {
    expect(DEFAULT_SETTINGS).toEqual({
      version: SETTINGS_VERSION,
      suggestions: true,
      rememberChoices: true,
      banglaDigits: true,
      dotToDari: true,
    });
  });

  it('first run returns the defaults', async () => {
    expect(await loadSettings(memoryArea())).toEqual(DEFAULT_SETTINGS);
  });

  it('migrates version-0 data (no version field)', () => {
    expect(normalizeSettings({ banglaDigits: false })).toEqual({ ...DEFAULT_SETTINGS, banglaDigits: false });
  });

  it('repairs wrong types and drops unknown keys', () => {
    const s = normalizeSettings({ version: 1, suggestions: 'no', dotToDari: 0, extra: true, banglaDigits: false });
    expect(s).toEqual({ ...DEFAULT_SETTINGS, banglaDigits: false });
    expect('extra' in s).toBe(false);
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings('garbage')).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps known keys from a newer version', () => {
    expect(normalizeSettings({ version: 9, suggestions: false, newThing: 1 })).toEqual({
      ...DEFAULT_SETTINGS,
      suggestions: false,
    });
  });

  it('saves one change and keeps the rest', async () => {
    const area = memoryArea({ [SETTINGS_KEY]: { version: 1, suggestions: false } });
    const saved = await saveSettings(area, { banglaDigits: false });
    expect(saved).toEqual({ ...DEFAULT_SETTINGS, suggestions: false, banglaDigits: false });
    expect(area.data[SETTINGS_KEY]).toEqual(saved);
    expect(await loadSettings(area)).toEqual(saved);
  });

  it('falls back to the defaults if storage fails', async () => {
    const broken: SettingsArea = {
      get: () => Promise.reject(new Error('quota')),
      set: () => Promise.reject(new Error('quota')),
    };
    expect(await loadSettings(broken)).toEqual(DEFAULT_SETTINGS);
  });
});

describe('Avro/Ridmik guide on the options page', () => {
  it.each(GUIDE.filter((r) => r.example !== '্').map((r) => [r.ridmik, r.example] as const))(
    'Ridmik input %s gives %s',
    (ridmik, example) => {
      expect(convertLetters(ridmik)).toBe(example);
    },
  );

  it('hasanta row', () => {
    expect(convertLetters('hs')).toBe('্');
  });
});
