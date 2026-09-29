/** Options page. Every change is saved at once; open tabs pick it up through storage.onChanged. */
import { chromeSettingsArea, LEARNED_KEY, loadSettings, saveSettings, SETTING_KEYS, watchSettings, type Settings } from '../shared/settings';
import { TOGGLE_COMMAND } from '../manifest';
import { GUIDE } from './guide';

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing`);
  return el;
}

const status = $('status');
function say(message: string): void {
  // Re-set even for the same text, so screen readers announce it again.
  status.textContent = '';
  requestAnimationFrame(() => {
    status.textContent = message;
  });
}

function checkbox(key: string): HTMLInputElement {
  return $(key) as HTMLInputElement;
}

function render(s: Settings): void {
  for (const key of SETTING_KEYS) checkbox(key).checked = s[key];
  checkbox('rememberChoices').disabled = !s.suggestions;
}

async function renderLearnedCount(): Promise<void> {
  const data = await chrome.storage.local.get(LEARNED_KEY);
  const list = data[LEARNED_KEY];
  const n = Array.isArray(list) ? list.length : 0;
  $('learned-count').textContent =
    n === 0 ? 'No remembered choices yet.' : `${n} remembered ${n === 1 ? 'choice' : 'choices'}.`;
  ($('clear-learned') as HTMLButtonElement).disabled = n === 0;
}

async function renderShortcut(): Promise<void> {
  const commands = await chrome.commands.getAll();
  const shortcut = commands.find((c) => c.name === TOGGLE_COMMAND)?.shortcut;
  $('shortcut').textContent = shortcut || 'not set';
}

function renderGuide(): void {
  const body = $('guide');
  body.replaceChildren(
    ...GUIDE.map((row) => {
      const tr = document.createElement('tr');
      const cells: Array<[string, string?]> = [[row.what], [row.example, 'bn'], [row.ridmik, 'code'], [row.avro, 'code']];
      for (const [text, kind] of cells) {
        const td = document.createElement('td');
        if (kind === 'code') {
          const code = document.createElement('code');
          code.textContent = text;
          td.append(code);
        } else {
          td.textContent = text;
          if (kind === 'bn') td.lang = 'bn';
        }
        tr.append(td);
      }
      return tr;
    }),
  );
}

for (const key of SETTING_KEYS) {
  checkbox(key).addEventListener('change', async (e) => {
    const on = (e.currentTarget as HTMLInputElement).checked;
    render(await saveSettings(chromeSettingsArea, { [key]: on }));
    say('Saved.');
  });
}

$('clear-learned').addEventListener('click', async () => {
  if (!confirm('Forget all remembered word choices? This cannot be undone.')) return;
  await chrome.storage.local.set({ [LEARNED_KEY]: [] });
  await renderLearnedCount();
  say('Learned words cleared.');
});

$('change-shortcut').addEventListener('click', () => {
  void chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && LEARNED_KEY in changes) void renderLearnedCount();
});
watchSettings(render);

renderGuide();
void loadSettings(chromeSettingsArea).then(render);
void renderLearnedCount();
void renderShortcut();
document.body.dataset.ready = 'true';
