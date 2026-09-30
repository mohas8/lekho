/**
 * Playground on the website: the extension's real typing engine, suggestion
 * list and dictionary, running in the page (no extension needed).
 */
import { Controller } from '../../src/content/controller';
import { SuggestClient } from '../../src/content/suggestClient';
import { SuggestionUi } from '../../src/content/suggestions';
import { SuggestionPopup } from '../../src/content/popup/popup';
import { createSuggestService } from '../../src/sw/suggestService';
import { LearnedChoices, type LearnedEntries } from '../../src/sw/learned';
import { DEFAULT_TRANSLITERATE_OPTIONS } from '../../src/engine/transliterate';
import { GUIDE } from '../../src/options/guide';

const base = import.meta.env.BASE_URL;

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing`);
  return el;
}

// Picks are remembered for this visit only.
let memory: LearnedEntries = [];
const learned = new LearnedChoices({
  load: async () => memory,
  save: async (e) => {
    memory = e;
  },
});

const service = createSuggestService(
  async (name) => {
    const res = await fetch(`${base}dict/w_${name}.json`);
    if (!res.ok) throw new Error(`dictionary ${name}: ${res.status}`);
    return (await res.json()) as string[];
  },
  { learned },
);

let ui: SuggestionUi | null = null;
const controller = new Controller(window, DEFAULT_TRANSLITERATE_OPTIONS, {
  onCompositionChange: (c) => ui?.onCompositionChange(c),
  interceptKey: (e) => ui?.interceptKey(e) ?? false,
  isOwnEvent: (e) => ui?.isOwnEvent(e) ?? false,
});
const client = new SuggestClient(
  async (msg) => {
    const r = await service.suggest(msg.roman);
    return { id: msg.id, roman: msg.roman, words: r?.words ?? [], preferred: r?.preferred };
  },
  (msg) => void service.learn(msg.roman, msg.word),
);
ui = new SuggestionUi(controller, client, new SuggestionPopup(document, (i) => ui?.choose(i)), window);
controller.attach();

const pad = $('pad') as HTMLTextAreaElement;
const toggle = $('toggle') as HTMLButtonElement;
const modeText = $('mode');

function setBangla(on: boolean): void {
  controller.setEnabled(on);
  if (!on) ui?.hide();
  toggle.setAttribute('aria-pressed', String(on));
  toggle.textContent = on ? 'বাংলা' : 'English';
  modeText.textContent = on ? 'Bangla typing is on' : 'Bangla typing is off';
  document.body.dataset.bangla = on ? 'on' : 'off';
}

toggle.addEventListener('click', () => {
  setBangla(!controller.isEnabled);
  pad.focus();
});

// Same shortcut as the extension.
window.addEventListener(
  'keydown',
  (e) => {
    if (e.ctrlKey && e.shiftKey && (e.code === 'Space' || e.key === ' ')) {
      e.preventDefault();
      setBangla(!controller.isEnabled);
    }
  },
  true,
);

for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-try]')) {
  btn.addEventListener('click', () => {
    // Show what to type; the visitor types it themselves.
    $('hint').textContent = `Type: ${btn.dataset.try}`;
    pad.focus();
  });
}

$('clear').addEventListener('click', () => {
  controller.finish();
  pad.value = '';
  pad.focus();
});

// Ridmik vs Avro table, from the same data as the extension's settings page.
$('guide').replaceChildren(
  ...GUIDE.map((row) => {
    const tr = document.createElement('tr');
    const cells: Array<[string, 'bn' | 'code' | 'text']> = [
      [row.what, 'text'],
      [row.example, 'bn'],
      [row.ridmik, 'code'],
      [row.avro, 'code'],
    ];
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

setBangla(true);
document.body.dataset.ready = 'true';
