# Chrome Web Store listing

Text for the store listing. Keep it in sync with `README.md` and `PRIVACY.md`.

## Name

Lekho – Bangla Phonetic Keyboard

## Summary (up to 132 characters)

Type Bangla on any website with Ridmik-style phonetic rules and word suggestions. Offline and private.

## Category

Productivity (Tools)

## Description

Lekho lets you type Bangla directly on web pages (Gmail, Facebook, Messenger, WhatsApp Web, X, Slack, Notion and
more) using the same phonetic rules as the Ridmik keyboard on Android. Type "ami korrmo kori" and get "আমি কর্ম করি",
right in the text box.

• Ridmik-style phonetic rules: the same English letters give the same Bangla as Ridmik, including rr for reph (কর্ম),
  TH for ৎ, qq or cb for ঁ, hs for hasanta, and ry for র‍্য.
• Word suggestions from a 150,000-word Bangla dictionary. The Ridmik result is always first, so your usual typing never
  changes; use ↓ and Space to pick another word.
• Remembers the words you pick (optional, stored only on your device).
• Bangla digits (২০২৬) and দাঁড়ি (।), each with an on/off switch.
• Works in plain text boxes and rich editors. Google Docs is supported on a best-effort basis.
• Private: works offline, no servers, no tracking. It only reads a page after you click its icon, and never touches
  password fields.

How to use: click the Lekho icon, or press Ctrl+Shift+Space, on the page where you want to type Bangla. The badge
shows বাং while it's on. Click again to go back to English.

Coming from Avro? A few signs are typed differently; the settings page has a side-by-side table.

Lekho isn't affiliated with Ridmik Labs or OmicronLab (Avro). It uses the open-source Ridmik Parser (BSD license) and
the Avro Phonetic dictionary from ibus-avro (MPL 2.0).

## Single purpose

Type Bangla on web pages with Ridmik-style phonetic rules.

## Permission justifications

- **activeTab**: gives access to the current tab only when the user clicks the toolbar icon or presses the keyboard
  shortcut, so the extension can turn typed English letters into Bangla in that tab.
- **scripting**: adds the typing script to the tab the user turned Lekho on for.
- **storage**: keeps the user's settings and (optionally) their remembered word choices on the device.

## Data usage disclosure

Collects no user data. Does not sell or transfer data. Remote code: none.
