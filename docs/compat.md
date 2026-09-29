# Site compatibility

How Lekho behaves on the sites it must support at launch, and how to check it by hand.
The automated tests use the editor libraries these sites are built on, and local copies of the
unusual cases. They can't sign in to the real sites, so the sites themselves are covered by the
manual checklist below.

## Automated coverage

| Editor / field type | Used by | Test |
|---|---|---|
| `<input type=text/search>`, `<textarea>` | search boxes, forms, Gmail subject | `plain-fields.spec.ts`, `injection.spec.ts` |
| Plain `contenteditable`, formatted text | Gmail compose body | `rich-editors.spec.ts` |
| Lexical (real library) | Facebook, Messenger, WhatsApp Web | `editor-libraries.spec.ts`, `popup-rich.spec.ts` |
| ProseMirror (real library, the core of Tiptap) | Notion- and Slack-style editors | `editor-libraries.spec.ts`, `popup-rich.spec.ts` |
| Quill (real library) | many web apps | `editor-libraries.spec.ts`, `popup-rich.spec.ts` |
| Editor that cancels `beforeinput` and re-renders | model-driven editors in general | `rich-editors.spec.ts` |
| React controlled input and `contenteditable` | React apps (X, Facebook, …) | `rich-editors.spec.ts` |
| Open shadow DOM input and editor; focus moving between them | web-component apps | `rich-editors.spec.ts`, `hardening.spec.ts` |
| Same-origin, `srcdoc`/designMode and later-added iframes | embedded editors | `rich-editors.spec.ts` |
| Hidden input iframe whose text is consumed (Google Docs model) | Google Docs | `hardening.spec.ts` |
| Page key handlers, fields replaced mid-word | all sites | `hardening.spec.ts` |
| Speed: 500 words | all sites | `hardening.spec.ts` |

Measured on the development machine (headless Chromium, ARM64), typing 500 words into a textarea:
Lekho's own work is about 0.1 ms per key (median) and 0.8 ms (95th percentile). Including the browser's text
editing, which normal typing costs as well, the total is about 1.2 ms (median) and 3.9 ms (95th percentile).

## Google Docs (best effort)

Docs draws the document itself and reads keystrokes from a hidden iframe (`.docs-texteventtarget-iframe`),
moving any text there into its own model at once. So Lekho can't rewrite a word in place, as it does elsewhere:

- The word being typed is shown **only in the suggestion list** (next to Docs' caret), which appears even if
  suggestions are turned off.
- When the word ends (space, punctuation, Enter, choosing a candidate, clicking), it is inserted once.
  Backspace inside a word edits the preview; Backspace after a finished word reaches Docs as usual.
- A full stop becomes । when the next key is typed (it might still be a decimal point).
- If Docs changes and the hidden input can't be found, the toolbar badge shows **!** with an explanation.

This relies on Docs internals that Google may change without notice.

## Manual checklist

Run with the production build loaded unpacked (`npm run build`, then load `dist/` at `chrome://extensions`).

For every site:

1. Open the page and click the Lekho icon (or press `Ctrl+Shift+Space`). The badge shows **বাং**.
2. Type `ami korrmo kori` → **আমি কর্ম করি**.
3. Type `bangla`, press Backspace twice, type `ladesh` → **বাংলাদেশ**.
4. Type `kormo`, press ↓, then Space → **কর্ম** (the second candidate).
5. Press Enter / Send: the message or post is sent as it would be without Lekho.
6. Undo (`Ctrl+Z`) after typing a word removes it.
7. Turn Lekho off. English typing is unchanged.

| Site | Field(s) | Status | Notes |
|---|---|---|---|
| Gmail | To, Subject, compose body, search | not yet checked | |
| Facebook | post composer, comments | not yet checked | |
| Messenger | message box | not yet checked | |
| WhatsApp Web | message box, search | not yet checked | |
| X | post composer, replies, DMs | not yet checked | |
| Slack | message box, threads | not yet checked | |
| Notion | page body, titles | not yet checked | |
| Google Docs | document body | best effort, not yet checked | See above |

Update the Status column with the date and Chrome version when checked.

## Known limitations

- **Chrome's protected pages:** `chrome://` pages, the Chrome Web Store and the built-in PDF viewer can't be scripted
  by any extension. The badge shows **!**.
- **Iframes from another site:** clicking the icon grants access only to the site in the address bar, so an editor
  embedded from a different site (for example a third-party comment widget) isn't reached.
- **Cross-site navigation:** after going to a different site, the tab returns to off; click the icon again. Reloads
  and navigation within the same site keep it on.
- **Right after a click**, Chrome occasionally hasn't applied the tab permission yet; Lekho retries once (after
  200 ms) before showing **!**.
- **Closed shadow roots** hide their fields from extensions.
- **Another input method active** (an OS IME): Lekho steps aside while it is composing.
- **Page shortcuts on letter keys** registered before Lekho was turned on (on `window`, capture phase) run first;
  if they cancel a key, Lekho leaves it alone.
