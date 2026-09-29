# Ridmik Parser: port notes and fixes

Lekho's phonetic engine (`src/engine/ridmik.ts`, `src/engine/map.ts`) is a TypeScript port of the open-source
[Ridmik Parser, JavaScript implementation](https://github.com/sha256/Ridmik-Parser-Javascript)
(BSD-3-Clause, © 2012 Shamim Hasnath). The unmodified original files are kept in `test/reference/` and used
only by tests.

## Parity guarantee

For any run of ASCII letters (`[A-Za-z]+`) the port produces exactly the same output as the original.
`test/unit/ridmik.test.ts` checks this on every test run:

- 10,000 random strings of 1–15 letters (upper and lower case)
- 10,000 strings built from Ridmik-style pieces (`rr`, `TH`, `qq`, `cb`, `hs`, `nj`, `nc`, `kkh`, `gg`, `OI`, `OU`, `rri`, …)
- 2,000 space-separated multi-word strings, compared against the original on the whole string
- golden cases such as `korrmo` → কর্ম, `kormo` → করম, `TH` → ৎ, `ry` → র‍্য, `gonj` → গঞ্জ

## Differences from the original

All of these are outside letter runs.

| # | Original behaviour | Lekho | Example |
|---|---|---|---|
| 1 | Digits pass the input filter but are never written, so they vanish. | Digits are kept (as ০–৯ or 0–9, per setting). | `2026` → ২০২৬ (original: empty) |
| 2 | A digit leaves the parser in the middle of a word, so a following vowel becomes a stray vowel sign (kar). | Letter runs are converted independently, so the vowel is written in full. | `2a` → ২আ (original: া) |
| 3 | A non-letter resets only `carry`; `secondCarry`, `thirdCarry` and the conjunct flags survive into the next word. | Every non-letter resets all state. | No input found where this changes the output (200,000 random two-word samples). |

## Extension-level settings (not part of the parser)

The parser defines no mapping for digits or punctuation (on Android, the Ridmik keyboard itself has separate keys for them). Lekho adds two settings, both on by default:

- **Bangla digits:** `0–9` → `০–৯`
- **Full stop to dari:** `.` → `।`, except a `.` between two digits (decimal point, `10.5` → ১০.৫) and runs of two
  or more dots (ellipsis, `ki...` → কি...)

All other characters (`,` `?` `!` `:` `$` …) pass through unchanged, as in the original.
