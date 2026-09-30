# Chrome Web Store submission

Everything the [Developer Dashboard](https://chrome.google.com/webstore/devconsole/) asks for, in the order the tabs
appear. Text blocks are unwrapped so they can be pasted as is.

## Package

Upload `lekho-<version>.zip` from the [GitHub release](https://github.com/mohas8/lekho/releases/latest), or build it
with `npm run package` (writes `release/lekho-<version>.zip`).

## Store listing tab

**Name** (from the manifest): Lekho — Ridmik Bangla Phonetic Keyboard

**Summary** (from the manifest description; 132 characters max):

```
Type Bangla on any web page with Ridmik-style phonetic rules and word suggestions. Offline; nothing you type leaves your device.
```

**Description:**

```
Lekho lets you type Bangla directly on web pages (Gmail, Facebook, Messenger, WhatsApp Web, X, Slack, Notion and more) using the same phonetic rules as the Ridmik keyboard on Android. Type "ami korrmo kori" and get "আমি কর্ম করি", right in the text box.

• Ridmik-style phonetic rules: the same English letters give the same Bangla as Ridmik, including rr for reph (কর্ম), TH for ৎ, qq or cb for ঁ, hs for hasanta, and ry for র‍্য.
• Word suggestions from a 150,000-word Bangla dictionary. The Ridmik result is always first, so your usual typing never changes; use ↓ and Space to pick another word.
• Remembers the words you pick (optional, stored only on your device).
• Bangla digits (২০২৬) and দাঁড়ি (।), each with an on/off switch.
• Works in plain text boxes and rich editors. Google Docs is supported on a best-effort basis.
• Private: works offline, no servers, no tracking. It only reads a page after you click its icon, and never touches password fields.

How to use: click the Lekho icon, or press Ctrl+Shift+Space, on the page where you want to type Bangla. The badge shows বাং while it's on. Click again to go back to English.

Coming from Avro? A few signs are typed differently; the settings page has a side-by-side table.

Found a word that comes out differently from Ridmik on your phone? Report it at github.com/mohas8/lekho/issues

Lekho isn't affiliated with Ridmik Labs or OmicronLab (Avro). It uses the open-source Ridmik Parser (BSD license) and the Avro Phonetic dictionary from ibus-avro (MPL 2.0).

Made by Md Mobashir Hasan (mobashir.dev). Open source: github.com/mohas8/lekho
```

**Category:** Productivity → Tools · **Language:** English

**Graphic assets** (all in `docs/store/`, regenerate with `npm run store-assets`):

| Field | File |
|---|---|
| Store icon (128×128) | `store-icon-128.png` |
| Screenshots (1280×800), in this order | `screenshot-1-typing.png`, `screenshot-2-suggestions.png`, `screenshot-3-settings.png`, `screenshot-4-avro-guide.png` |
| Small promo tile (440×280) | `promo-small-440x280.png` |
| Marquee promo tile (1400×560) | `promo-marquee-1400x560.png` |

**Additional fields:**

- Official URL: none (only shows sites verified in Google Search Console; add mobashir.dev later if you verify it)
- Homepage URL: `https://mobashir.dev/lekho`
- Support URL: `https://github.com/mohas8/lekho/issues`
- Mature content: No

## Privacy tab

**Single purpose:**

```
Lets the user type Bangla on web pages: English letters typed in a text field are converted to Bangla with Ridmik-style phonetic rules, with optional word suggestions.
```

**Permission justifications:**

- activeTab:
  ```
  Lekho only works in a tab after the user clicks its toolbar icon or presses its keyboard shortcut there. activeTab gives access to that one tab at that moment, so Lekho can convert what the user types into Bangla, without asking for access to all websites.
  ```
- scripting:
  ```
  Used to add Lekho's typing script (included in the package) to the tab the user turned Lekho on for, and to the frames inside it. No remote code is loaded.
  ```
- storage:
  ```
  Keeps the user's settings (suggestions, Bangla digits, full stop) and, if enabled, the words the user picked from the suggestion list, only on the user's device (chrome.storage.local). Which tabs are turned on is kept in chrome.storage.session.
  ```

**Remote code:** No, I am not using remote code.

**Data usage:** tick none of the data types. Lekho reads what the user types in the focused field only to convert it
to Bangla on the device; it never stores or sends it. Then tick all three certifications (not sold, not used for
unrelated purposes, not used for creditworthiness).

**Privacy policy URL:** `https://github.com/mohas8/lekho/blob/main/PRIVACY.md`

## Distribution tab

- Payments: Free
- Visibility: Public (or Unlisted for a soft launch with a direct link)
- Regions: All regions

## Test instructions tab

```
No account or login needed.
1. Open any page with a text box (for example https://www.google.com).
2. Click the Lekho toolbar icon (or press Ctrl+Shift+Space). The badge shows "বাং".
3. Click in the text box and type: ami korrmo kori
   Result: আমি কর্ম করি
4. Type "kormo": a suggestion list appears under the word. Press the Down arrow, then Space: কর্ম is inserted.
5. Click the icon again: the badge shows "EN" and typing is English again.
Settings: right-click the icon → Options.
```
