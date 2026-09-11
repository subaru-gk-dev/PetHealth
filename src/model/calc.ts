// Pure aggregation helpers used by the timeline and charts. No DOM, no Firebase,
// so they are unit-tested with Vitest.

import type { Entry, StoolData, WaterData, WaterKind, WeightData } from './entry';

/** Local calendar day key (YYYY-MM-DD) for an epoch-ms timestamp. */
export function dayKey(atMs: number): string {
  const d = new Date(atMs);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Epoch ms for local midnight of the given day key. */
export function dayStart(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

/** Inclusive list of day keys from `from` to `to` (both day keys). */
export function dayRange(from: string, to: string): string[] {
  const out: string[] = [];
  let t = dayStart(from);
  const end = dayStart(to);
  while (t <= end) {
    out.push(dayKey(t));
    t += 24 * 60 * 60 * 1000;
    // Guard against DST shifting the hour: re-anchor to midnight.
    const d = new Date(t);
    t = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  }
  return out;
}

/** Last `days` day keys ending today (or `endMs`). */
export function lastDays(days: number, endMs = Date.now()): string[] {
  const end = dayKey(endMs);
  const startMs = dayStart(end) - (days - 1) * 24 * 60 * 60 * 1000;
  return dayRange(dayKey(startMs), end);
}

export type WaterByKind = Record<WaterKind, number>;

export function emptyWaterByKind(): WaterByKind {
  return { water: 0, milk: 0, broth: 0, other: 0 };
}

/** Daily water intake in ml, split by kind. Days with no intake are present with zeros. */
export function waterByDay(entries: Entry[], days: string[]): Map<string, WaterByKind> {
  const map = new Map<string, WaterByKind>();
  for (const d of days) map.set(d, emptyWaterByKind());
  for (const e of entries) {
    if (e.type !== 'water') continue;
    const key = dayKey(e.at);
    const bucket = map.get(key);
    if (!bucket) continue;
    const data = e.data as WaterData;
    const ml = Number.isFinite(data.ml) ? data.ml : 0;
    bucket[data.kind ?? 'other'] += ml;
  }
  return map;
}

export function totalMl(byKind: WaterByKind): number {
  return byKind.water + byKind.milk + byKind.broth + byKind.other;
}

/**
 * Water intake per kg body weight per day.
 * Typical dog: 50-60 ml/kg/day. >100 ml/kg/day is considered polydipsia.
 */
export const WATER_ML_PER_KG_NORMAL_LOW = 50;
export const WATER_ML_PER_KG_NORMAL_HIGH = 60;
export const WATER_ML_PER_KG_POLYDIPSIA = 100;

export function mlPerKg(totalMlPerDay: number, weightKg: number | undefined): number | undefined {
  if (!weightKg || weightKg <= 0) return undefined;
  return Math.round((totalMlPerDay / weightKg) * 10) / 10;
}

/** Derive drunk amount from offered and left amounts; never negative. */
export function drunkMl(offeredMl: number, leftMl: number): number {
  const v = offeredMl - leftMl;
  return v > 0 ? Math.round(v) : 0;
}

export interface StoolDaySummary {
  count: number;
  /** Mean stool score over entries that have a score; undefined when none. */
  meanScore?: number;
  blood: boolean;
}

export function stoolByDay(entries: Entry[], days: string[]): Map<string, StoolDaySummary> {
  const map = new Map<string, StoolDaySummary>();
  for (const d of days) map.set(d, { count: 0, blood: false });
  const scoreSum = new Map<string, { sum: number; n: number }>();
  for (const e of entries) {
    if (e.type !== 'stool') continue;
    const key = dayKey(e.at);
    const s = map.get(key);
    if (!s) continue;
    s.count += 1;
    const data = e.data as StoolData;
    if (data.blood) s.blood = true;
    if (data.score) {
      const acc = scoreSum.get(key) ?? { sum: 0, n: 0 };
      acc.sum += data.score;
      acc.n += 1;
      scoreSum.set(key, acc);
    }
  }
  for (const [key, acc] of scoreSum) {
    const s = map.get(key)!;
    s.meanScore = Math.round((acc.sum / acc.n) * 10) / 10;
  }
  return map;
}

/** Latest weight entry at or before `atMs`, if any. */
export function latestWeightKg(entries: Entry[], atMs = Date.now()): number | undefined {
  let best: Entry | undefined;
  for (const e of entries) {
    if (e.type !== 'weight' || e.at > atMs) continue;
    if (!best || e.at > best.at) best = e;
  }
  return best ? (best.data as WeightData).kg : undefined;
}

/** Weight series (day key -> last kg recorded that day), sorted by day. */
export function weightSeries(entries: Entry[]): { day: string; kg: number }[] {
  const byDay = new Map<string, Entry>();
  for (const e of entries) {
    if (e.type !== 'weight') continue;
    const key = dayKey(e.at);
    const prev = byDay.get(key);
    if (!prev || e.at > prev.at) byDay.set(key, e);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([day, e]) => ({ day, kg: (e.data as WeightData).kg }));
}

/** Weight normalised to two decimals (0.01 kg resolution). */
export function roundKg(kg: number): number {
  return Math.round(kg * 100) / 100;
}

/** Weight for display, always two decimals (e.g. "6.20"). */
export function fmtKg(kg: number): string {
  return roundKg(kg).toFixed(2);
}

/** Entries sorted newest first. */
export function sortNewestFirst<T extends Entry>(entries: T[]): T[] {
  return [...entries].sort((a, b) => b.at - a.at);
}
