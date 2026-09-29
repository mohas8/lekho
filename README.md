# Lekho – Ridmik-style Bangla phonetic typing for Chrome

Lekho lets you type Bangla directly on web pages with the phonetic rules of the Ridmik keyboard for Android. The
same English letters give the same Bangla as on your phone, in Gmail, Facebook, WhatsApp Web, Slack, Notion and
most other sites. It works offline, and nothing you type leaves your device.

```
ami korrmo kori   →   আমি কর্ম করি
```

## Why

- **Avro for Chrome** only types inside its own popup; you copy the text out. Lekho types in the page itself.
- **Avro on Windows** uses Avro's phonetic rules, which differ from Ridmik's in places (reph, ৎ, ঁ, hasanta,
  conjuncts). It also has platform problems: the ESET keyboard-protection conflict, Windows 11 breakage, and needing
  admin rights to install.

## Install

From the Chrome Web Store (once published), or from source:

```sh
npm ci
npm run build          # production build in dist/
```

Then open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and choose the `dist/` folder.
To make a store zip: `npm run package` (writes `release/lekho-<version>.zip`).

Requires Node 20.19 or later to build, and Chrome 120 or later to run.

## Use

1. On the page where you want to type Bangla, click the Lekho icon or press **Ctrl+Shift+Space**. The badge shows
   **বাং**.
2. Type phonetically. Each word turns into Bangla as you type.
3. A list of suggestions appears under the word. The Ridmik result is first and chosen by default:
   - **Space**, punctuation or **Tab**: keep the highlighted word and go on
   - **↓ / ↑**: highlight another word (the field shows it straight away)
   - **Enter**: if you moved the highlight, picks the word; otherwise works as usual (new line, send)
   - **Esc**: close the list
   - The last entry is the English word as typed.
4. Click the icon again, or press the shortcut, to go back to English.

Change the shortcut at `chrome://extensions/shortcuts`. Settings (suggestions, remembered choices, Bangla digits,
। for full stop) are on the extension's options page.

### Ridmik and Avro differences

| Bangla | Lekho (Ridmik) | Avro |
|---|---|---|
| কর্ম (reph) | `korrmo` | `kormo` |
| করম | `kormo` | `korom` |
| হঠাৎ (ৎ) | `hoThaTH` | ``hoThat`` `` |
| চাঁদ (ঁ) | `caqqd` or `cacbd` | `ca^d` |
| ্ (hasanta) | `hs` | `,,` |
| র‍্যাব | `ryab` | `rZab` |
| গঞ্জ / পঞ্চ | `gonj` / `ponc` | `goNGj` / `poNGc` |

## Privacy and permissions

Lekho asks for `activeTab`, `scripting` and `storage` only. It gets access to a tab only when you click its icon or
press its shortcut there, so installing it shows no "read and change all your data" warning. It makes no network
requests, and never touches password or one-time-code fields. See [PRIVACY.md](PRIVACY.md).

## Limitations

- Chrome's own pages (`chrome://`, the Web Store, the PDF viewer) can't be typed into by any extension; the badge
  shows **!**.
- Editors embedded from another site, and fields inside closed shadow roots, aren't reached.
- After navigating to a different site, click the icon again.
- Google Docs is best effort: the word you're typing shows only in the suggestion list and is inserted when you finish
  it.

Details and the manual test checklist: [docs/compat.md](docs/compat.md).

## Development

| Command | What it does |
|---|---|
| `npm run build` | Production build → `dist/` |
| `npm run build:test` | Test build (test hooks, localhost access) → `dist-test/` |
| `npm test` | Unit tests (Vitest), including the Ridmik parity tests |
| `npm run test:e2e` | Browser tests (Playwright, headless Chromium with the extension loaded) |
| `npm run typecheck` / `npm run lint` | TypeScript and ESLint |
| `npm run fixtures` | Serves the test pages on http://localhost:4173 |
| `npm run ridmik -- "ami korrmo kori"` | Converts text with the Ridmik rules |
| `npm run suggest -- kormo` | Shows ranked suggestions |
| `npm run package` | Production build + store zip in `release/` |

The first time, install Playwright's browser: `npx playwright install chromium`.

### How it's built

- `src/engine/`: the Ridmik engine, a port of the open-source [Ridmik Parser](https://github.com/sha256/Ridmik-Parser-Javascript).
  Its output is compared with the unmodified original on 20,000+ random inputs on every test run; the few fixes
  outside letter runs are listed in [docs/ridmik-parser-fixes.md](docs/ridmik-parser-fixes.md).
- `src/content/`: the script injected into pages. It handles keys, writes into text fields and rich editors
  (`execCommand`, so undo and frameworks keep working), and shows the suggestion list (shadow DOM).
- `src/suggest/`: dictionary search, a port of [ibus-avro](https://github.com/sarim/ibus-avro)'s Avro Phonetic search,
  extended for Ridmik's signs. Candidates are ranked by closeness to the Ridmik result.
- `src/sw/`: the service worker. It manages which tabs are on, the badge, the suggestion service and learned choices.
- `src/options/`: the settings page.

## License

[MPL-2.0](LICENSE). Includes the Ridmik Parser (BSD-3-Clause) and the Avro Phonetic dictionary and search from
ibus-avro (MPL-2.0); see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Lekho isn't affiliated with Ridmik Labs or
OmicronLab.
