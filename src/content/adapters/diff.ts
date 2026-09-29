/**
 * The smallest edit that turns `before` into `after` at the end of a word:
 * keep the first `keep` characters, replace the rest with `insert`.
 *
 * Appending (after starts with before) inserts at the caret, like native
 * typing: "ক" -> "কা" inserts "া". A replacement never starts in the middle
 * of a character cluster (at a vowel sign or other combining mark, or right
 * after a hasanta or joiner); the cut moves left to the cluster start
 * instead, so editors never see a selection that splits a cluster.
 */
const COMBINING = /[\u0981-\u0983\u09bc\u09be-\u09cd\u09d7\u09e2\u09e3\u09fe\u200c\u200d]/;
const JOINING = /[\u09cd\u200c\u200d]/;

export function editSpan(before: string, after: string): { keep: number; insert: string } {
  let keep = 0;
  const max = Math.min(before.length, after.length);
  while (keep < max && before[keep] === after[keep]) keep++;
  if (keep < before.length) {
    while (keep > 0 && (COMBINING.test(before[keep] ?? '') || JOINING.test(before[keep - 1] ?? ''))) keep--;
  }
  return { keep, insert: after.slice(keep) };
}
