/**
 * "Coming from Avro?" reference shown on the options page: how to type the
 * signs where Ridmik and Avro differ. The Ridmik column is checked against
 * the engine in test/unit/settings.test.ts.
 */
export interface GuideRow {
  readonly what: string;
  readonly example: string;
  /** Ridmik input producing `example`. */
  readonly ridmik: string;
  /** Avro Phonetic input producing `example` (from Avro's published layout). */
  readonly avro: string;
}

export const GUIDE: readonly GuideRow[] = [
  { what: 'Reph (র্)', example: 'কর্ম', ridmik: 'korrmo', avro: 'kormo' },
  { what: 'No reph', example: 'করম', ridmik: 'kormo', avro: 'korom' },
  { what: 'Khondo-to (ৎ)', example: 'হঠাৎ', ridmik: 'hoThaTH', avro: 'hoThat``' },
  { what: 'Chandrabindu (ঁ)', example: 'চাঁদ', ridmik: 'caqqd', avro: 'ca^d' },
  { what: 'Hasanta (্)', example: '্', ridmik: 'hs', avro: ',,' },
  { what: 'Ro-fola with jo-fola (র‍্য)', example: 'র\u200D্যাব', ridmik: 'ryab', avro: 'rZab' },
  { what: 'ঞ্জ', example: 'গঞ্জ', ridmik: 'gonj', avro: 'goNGj' },
  { what: 'ঞ্চ', example: 'পঞ্চ', ridmik: 'ponc', avro: 'poNGc' },
];
