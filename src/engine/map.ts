/*
 * Character tables for the Ridmik phonetic engine.
 *
 * Ported from Ridmik Parser (JavaScript implementation), ridmikmap.js
 * Copyright (c) 2012, Shamim Hasnath. All rights reserved.
 * Licensed under the BSD 3-Clause License; see THIRD_PARTY_NOTICES.md.
 *
 * Tables keep the original keys and their effective values. The original
 * assigns jkt["g"] twice (same value) and jkt["dh"] twice ("wn", then ""), so
 * the effective value of JKT.dh is "".
 */

/** Frozen lookup table without a prototype, so no inherited keys can match. */
function table(entries: Record<string, string>): Readonly<Record<string, string>> {
  return Object.freeze(Object.assign(Object.create(null) as Record<string, string>, entries));
}

/** Character map (`m` in the original). */
export const CHAR = table({
  o: '\u0985',
  O: '\u0993',
  a: '\u0986',
  A: '\u0986',
  S: '\u09B6',
  sh: '\u09B6',
  s: '\u09B8',
  Sh: '\u09B7',
  h: '\u09B9',
  H: '\u09B9',
  r: '\u09B0',
  R: '\u09DC',
  Rh: '\u09DD',
  k: '\u0995',
  K: '\u0995',
  q: '\u0995',
  qq: '\u0981',
  kh: '\u0996',
  g: '\u0997',
  G: '\u0997',
  gh: '\u0998',
  Ng: '\u0999',
  c: '\u099A',
  C: '\u099A',
  ch: '\u099B',
  j: '\u099C',
  jh: '\u099D',
  J: '\u099C',
  NG: '\u099E',
  T: '\u099F',
  Th: '\u09A0',
  TH: '\u09CE',
  f: '\u09AB',
  F: '\u09AB',
  ph: '\u09AB',
  i: '\u0987',
  I: '\u0988',
  e: '\u098F',
  E: '\u098F',
  u: '\u0989',
  U: '\u098A',
  b: '\u09AC',
  B: '\u09AC',
  w: '\u09AC',
  bh: '\u09AD',
  V: '\u09AD',
  v: '\u09AD',
  t: '\u09A4',
  th: '\u09A5',
  d: '\u09A6',
  dh: '\u09A7',
  D: '\u09A1',
  Dh: '\u09A2',
  n: '\u09A8',
  N: '\u09A3',
  z: '\u09AF',
  Z: '\u09AF',
  y: '\u09DF',
  l: '\u09B2',
  L: '\u09B2',
  m: '\u09AE',
  M: '\u09AE',
  P: '\u09AA',
  p: '\u09AA',
  ng: '\u0982',
  cb: '\u0981',
  x: '\u0995\u09CD\u09B8',
  OU: '\u0994',
  OI: '\u0990',
  hs: '\u09CD',
  nj: '\u099E\u09CD\u099C',
  nc: '\u099E\u09CD\u099A',
});

/** Vowel-sign (kar) map (`k` in the original). */
export const KAR = table({
  o: '',
  a: '\u09BE',
  A: '\u09BE',
  e: '\u09C7',
  E: '\u09C7',
  O: '\u09CB',
  OI: '\u09C8',
  OU: '\u09CC',
  i: '\u09BF',
  I: '\u09C0',
  u: '\u09C1',
  U: '\u09C2',
  oo: '\u09C1',
});

/** Which consonants may join under a consonant to form a conjunct (`jkt`). */
export const JKT = table({
  k: 'kTtnNslw',
  g: 'gnNmlw',
  ch: 'w',
  Ng: 'gkm',
  NG: 'cj',
  G: 'gnNmlw',
  th: 'w',
  gh: 'Nn',
  c: 'c',
  j: 'jw',
  T: 'T',
  D: 'D',
  R: 'g',
  N: 'DNmw',
  t: 'tnmwN',
  d: 'wdm',
  dh: '',
  n: 'ndwmtsDT',
  p: 'plTtns',
  f: 'l',
  ph: 'l',
  b: 'jdbwl',
  v: 'l',
  bh: 'l',
  m: 'npfwvmlb',
  l: 'lwmpkgTDf',
  Sh: 'kTNpmf',
  S: 'clwnm',
  sh: 'clwnm',
  s: 'kTtnpfmlw',
  h: 'Nnmlw',
  cb: '',
  jh: '',
  TH: '',
  qq: '',
  ng: '',
  kh: '',
  gg: '',
  Th: '',
});

/** Two-letter consonants that sit under a preceding consonant (`djkt`). */
export const DJKT = table({
  kh: 'Ngs',
  ch: 'c',
  Dh: 'N',
  ph: 'mls',
  dh: 'gdnbl',
  bh: 'dm',
  Sh: 'k',
  th: 'tns',
  Th: 'Nn',
  jh: 'j',
  NG: 'cj',
});

/** Two-letter consonants that sit under a preceding two-letter consonant (`djktt`). */
export const DJKTT = table({
  ch: 'NG',
  gh: 'Ng',
  Th: 'Sh',
  jh: 'NG',
  sh: 'ch',
});
