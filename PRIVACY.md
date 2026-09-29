# Lekho privacy policy

_Last updated: 2026-09-29_

Lekho is a Bangla typing extension. It works entirely on your device.

## What Lekho does not do

- It does **not** collect, send, sell or share any data. It has no servers and makes no network requests. The
  dictionary is packaged with the extension.
- It does **not** read pages you haven't turned it on for. Chrome gives it access to a tab only after you click its
  icon or press its shortcut in that tab (the `activeTab` permission). Access ends when you close the tab or go to
  another site.
- It does **not** touch password fields, one-time-code fields, or email, phone, number and URL fields.
- It has no analytics, ads or tracking.

## What Lekho stores on your device

Stored with `chrome.storage.local`, which stays on this device and is not synced:

| Data | Why | How to remove |
|---|---|---|
| Your settings (suggestions, digits, full stop, remember choices) | To apply them | Remove the extension |
| Remembered word choices (English word → Bangla word you picked), at most 5,000 | To offer your choice first next time | Settings → **Clear learned words**, turn off **Remember my choices**, or remove the extension |

Which tabs have Lekho turned on is kept in `chrome.storage.session`, which Chrome clears when the browser closes.

While Lekho is on in a tab, it reads what you type in the focused text field, only to turn it into Bangla. It never
stores or sends the text.

## Permissions

| Permission | Why |
|---|---|
| `activeTab` | Access to the current tab, only after you click the icon or press the shortcut |
| `scripting` | To add the typing script to that tab |
| `storage` | To keep your settings and remembered choices on this device |

## Contact

Please report privacy questions or problems through the project's issue tracker.
