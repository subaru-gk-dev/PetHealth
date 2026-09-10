// Domain types for one log entry. Every entry has an actual event time (`at`)
// that the user may correct afterwards, plus who recorded it and when.

export type EntryType =
  | 'stool'
  | 'urine'
  | 'water'
  | 'meal'
  | 'med'
  | 'weight'
  | 'vital'
  | 'vomit'
  | 'vet'
  | 'note';

export const ENTRY_TYPES: EntryType[] = [
  'stool',
  'water',
  'meal',
  'urine',
  'med',
  'weight',
  'vital',
  'vomit',
  'vet',
  'note',
];

export const ENTRY_LABEL: Record<EntryType, string> = {
  stool: '便',
  urine: '尿',
  water: '飲水',
  meal: '食事',
  med: '薬',
  weight: '体重',
  vital: 'バイタル',
  vomit: '嘔吐',
  vet: '通院',
  note: 'メモ',
};

export const ENTRY_ICON: Record<EntryType, string> = {
  stool: '💩',
  urine: '💧',
  water: '🥛',
  meal: '🍚',
  med: '💊',
  weight: '⚖️',
  vital: '🫀',
  vomit: '🤢',
  vet: '🏥',
  note: '📝',
};

/** Stool consistency, 1 = very hard ... 7 = watery (canine fecal score). */
export type StoolScore = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type StoolColor = 'brown' | 'dark' | 'light' | 'yellow' | 'green' | 'black' | 'red';
export type Amount = 'small' | 'normal' | 'large';

export interface StoolData {
  score?: StoolScore;
  color?: StoolColor;
  amount?: Amount;
  blood?: boolean;
  mucus?: boolean;
}

export type UrineColor = 'pale' | 'normal' | 'dark' | 'bloody';
export interface UrineData {
  color?: UrineColor;
  amount?: Amount;
}

export type WaterKind = 'water' | 'milk' | 'broth' | 'other';
export const WATER_KIND_LABEL: Record<WaterKind, string> = {
  water: '水',
  milk: '薄めミルク',
  broth: 'ささみ煮汁',
  other: 'その他',
};
export interface WaterData {
  kind: WaterKind;
  /** Amount actually drunk, in ml. */
  ml: number;
  /** Optional: amount offered and amount left, used to derive `ml`. */
  offeredMl?: number;
  leftMl?: number;
  /** Optional dilution for milk: concentrate ml + water ml. */
  milkMl?: number;
  waterMl?: number;
}

export type Leftover = 'none' | 'half' | 'most';
export interface MealData {
  food?: string;
  grams?: number;
  leftover?: Leftover;
  /** 1 = no appetite ... 5 = ate eagerly. */
  appetite?: 1 | 2 | 3 | 4 | 5;
  treat?: boolean;
  therapeutic?: boolean;
}

export interface MedData {
  name: string;
  dose?: string;
  given: boolean;
}

export interface WeightData {
  kg: number;
}

export interface VitalData {
  tempC?: number;
  /** Resting respiratory rate, breaths per minute. */
  rrPerMin?: number;
  hrPerMin?: number;
}

export interface VomitData {
  content?: 'food' | 'foam' | 'bile' | 'other';
  count?: number;
}

export interface VetData {
  clinic?: string;
  diagnosis?: string;
  prescription?: string;
  costYen?: number;
  nextVisit?: string; // YYYY-MM-DD
  labs?: Record<string, number>; // e.g. { BUN: 25, CRE: 1.2 }
}

export type NoteData = Record<string, never>;

export type EntryData =
  | StoolData
  | UrineData
  | WaterData
  | MealData
  | MedData
  | WeightData
  | VitalData
  | VomitData
  | VetData
  | NoteData;

export interface Entry<T extends EntryData = EntryData> {
  id: string;
  petId: string;
  type: EntryType;
  /** Event time in epoch ms (local device clock). */
  at: number;
  createdAt: number;
  createdBy: string;
  createdByName?: string;
  note?: string;
  /** Storage paths (cloud) or local blob keys (local mode). */
  photoPaths: string[];
  data: T;
}

export interface Pet {
  id: string;
  name: string;
  breed?: string;
  sex?: 'male' | 'female';
  birthDate?: string; // YYYY-MM-DD
  currentWeightKg?: number;
}

export interface Household {
  id: string;
  name: string;
  memberUids: string[];
  inviteCode: string;
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
