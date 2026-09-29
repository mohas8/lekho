/**
 * User settings, stored in chrome.storage.local (not sync storage, so they
 * never leave the device). Every reader goes through normalizeSettings, so
 * missing, old or corrupted data always yields a complete, valid object.
 */

export const SETTINGS_VERSION = 1;
export const SETTINGS_KEY = 'settings';
/** Learned word choices (see sw/learned.ts); defined here so the options page doesn't pull in the suggestion engine. */
export const LEARNED_KEY = 'learned';

export interface Settings {
  readonly version: number;
  /** Show the suggestion list while typing. */
  readonly suggestions: boolean;
  /** Highlight the candidate picked last time for the same word. */
  readonly rememberChoices: boolean;
  /** 0-9 -> ০-৯ */
  readonly banglaDigits: boolean;
  /** "." -> "।" */
  readonly dotToDari: boolean;
}

export type SettingKey = Exclude<keyof Settings, 'version'>;

export const DEFAULT_SETTINGS: Settings = Object.freeze({
  version: SETTINGS_VERSION,
  suggestions: true,
  rememberChoices: true,
  banglaDigits: true,
  dotToDari: true,
});

export const SETTING_KEYS: readonly SettingKey[] = ['suggestions', 'rememberChoices', 'banglaDigits', 'dotToDari'];

/**
 * Turns whatever is stored into valid settings.
 *  - version 0 (no version field, the pre-release format) had the same keys
 *  - unknown keys are dropped; wrongly typed values fall back to the default
 *  - data from a newer version keeps the keys this version understands
 */
export function normalizeSettings(raw: unknown): Settings {
  const src = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const out: Record<string, unknown> = { version: SETTINGS_VERSION };
  for (const key of SETTING_KEYS) {
    const v = src[key];
    out[key] = typeof v === 'boolean' ? v : DEFAULT_SETTINGS[key];
  }
  return Object.freeze(out as unknown as Settings);
}

export interface SettingsArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

export async function loadSettings(area: SettingsArea): Promise<Settings> {
  try {
    return normalizeSettings((await area.get(SETTINGS_KEY))[SETTINGS_KEY]);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(area: SettingsArea, change: Partial<Record<SettingKey, boolean>>): Promise<Settings> {
  const next = normalizeSettings({ ...(await loadSettings(area)), ...change });
  await area.set({ [SETTINGS_KEY]: next });
  return next;
}

/** Calls `cb` with the new settings whenever they change in chrome.storage.local. */
export function watchSettings(cb: (s: Settings) => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'local' && SETTINGS_KEY in changes) cb(normalizeSettings(changes[SETTINGS_KEY]?.newValue));
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

export const chromeSettingsArea: SettingsArea = {
  get: (key) => chrome.storage.local.get(key) as Promise<Record<string, unknown>>,
  set: (items) => chrome.storage.local.set(items),
};
