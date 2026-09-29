# Third-party notices

Lekho is licensed under the Mozilla Public License 2.0 (see `LICENSE`). It includes work from the projects below.
Their notices are reproduced as their licenses require.

## Ridmik Parser

- Source: https://github.com/sha256/Ridmik-Parser-Javascript
- Used in: `src/engine/ridmik.ts`, `src/engine/map.ts` (a TypeScript port; the original files are kept, unmodified, in
  `test/reference/` for the parity tests)
- License: BSD 3-Clause

```
Copyright (c) 2012, Shamim Hasnath
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:
    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.
    * Neither the name of the above copyright holder nor the
      names of its contributors may be used to endorse or promote products
      derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL ABOVE COPYRIGHT HOLDER BE LIABLE FOR ANY
DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

## ibus-avro / jsAvroPhonetic (Avro Phonetic dictionary and suggestion search)

- Source: https://github.com/sarim/ibus-avro
- Used in: `src/suggest/` (ports of `avroregexlib.js`, `dbsearch.js`, `suggestionbuilder.js`, `levenshtein.js`),
  `src/suggest/data/` (pattern and suffix tables extracted from `avroregexlib.js` and `suffixdict.js`), and the
  word list `dict/*.json` in the built extension (converted from `avrodict.js`). The unmodified upstream files are
  in `vendor/ibus-avro/`.
- License: Mozilla Public License 2.0 (same text as `LICENSE`)
- Copyright (C) OmicronLab (http://www.omicronlab.com). All Rights Reserved.
  Initial developers: Mehdi Hasan Khan, Rifat Nabi. IBus engine: Sarim Khan.
- The Source Code Form of these files, and of Lekho's changes to them, is this repository.

"Avro" and "Avro Keyboard" are names of OmicronLab's software, and "Ridmik" is a name of Ridmik Labs' software.
Lekho isn't affiliated with or endorsed by either. The names are used only to describe compatibility.
