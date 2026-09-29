/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Port of levenshtein.js from ibus-avro (https://github.com/sarim/ibus-avro):
 * Damerau-Levenshtein distance, based on
 * http://en.wikibooks.org/wiki/Algorithm_implementation/Strings/Levenshtein_distance
 *
 * Behaviour is identical to the original, including the transposition step
 * adding `cost` rather than 1.
 */
export function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const d: number[][] = [];
  for (let i = 0; i <= a.length; i++) d[i] = [i];
  const row0 = d[0] as number[];
  for (let j = 0; j <= b.length; j++) row0[j] = j;

  for (let i = 1; i <= a.length; i++) {
    const row = d[i] as number[];
    const prev = d[i - 1] as number[];
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
      let v = Math.min((prev[j] as number) + 1, (row[j - 1] as number) + 1, (prev[j - 1] as number) + cost);
      if (i > 1 && j > 1 && a.charAt(i - 1) === b.charAt(j - 2) && a.charAt(i - 2) === b.charAt(j - 1)) {
        v = Math.min(v, ((d[i - 2] as number[])[j - 2] as number) + cost);
      }
      row[j] = v;
    }
  }
  return (d[a.length] as number[])[b.length] as number;
}
