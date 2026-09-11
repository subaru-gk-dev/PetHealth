import { describe, expect, it } from 'vitest';
import {
  dayKey,
  dayRange,
  drunkMl,
  fmtKg,
  lastDays,
  latestWeightKg,
  mlPerKg,
  roundKg,
  stoolByDay,
  totalMl,
  waterByDay,
  weightSeries,
} from '../src/model/calc';
import type { Entry } from '../src/model/entry';

function at(day: string, hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  const [y, mo, d] = day.split('-').map(Number);
  return new Date(y, mo - 1, d, h, m).getTime();
}

function entry(partial: Partial<Entry> & Pick<Entry, 'type' | 'at' | 'data'>): Entry {
  return {
    id: Math.random().toString(36).slice(2),
    petId: 'p1',
    createdAt: partial.at,
    createdBy: 'u1',
    photoPaths: [],
    ...partial,
  };
}

describe('dayKey / dayRange / lastDays', () => {
  it('formats local day key', () => {
    expect(dayKey(at('2026-09-10', '23:59'))).toBe('2026-09-10');
    expect(dayKey(at('2026-09-10', '00:00'))).toBe('2026-09-10');
  });

  it('builds an inclusive range', () => {
    expect(dayRange('2026-09-08', '2026-09-10')).toEqual([
      '2026-09-08',
      '2026-09-09',
      '2026-09-10',
    ]);
  });

  it('lastDays ends on the given day', () => {
    expect(lastDays(3, at('2026-09-10', '12:00'))).toEqual([
      '2026-09-08',
      '2026-09-09',
      '2026-09-10',
    ]);
  });
});

describe('waterByDay', () => {
  it('sums by kind and by day, zero-filling missing days', () => {
    const entries = [
      entry({ type: 'water', at: at('2026-09-09', '08:00'), data: { kind: 'milk', ml: 120 } }),
      entry({ type: 'water', at: at('2026-09-09', '20:00'), data: { kind: 'broth', ml: 80 } }),
      entry({ type: 'water', at: at('2026-09-10', '09:00'), data: { kind: 'milk', ml: 100 } }),
      entry({ type: 'meal', at: at('2026-09-10', '09:00'), data: { grams: 50 } }),
    ];
    const days = ['2026-09-08', '2026-09-09', '2026-09-10'];
    const m = waterByDay(entries, days);
    expect(totalMl(m.get('2026-09-08')!)).toBe(0);
    expect(m.get('2026-09-09')).toEqual({ water: 0, milk: 120, broth: 80, other: 0 });
    expect(totalMl(m.get('2026-09-10')!)).toBe(100);
  });
});

describe('mlPerKg / drunkMl', () => {
  it('converts to ml per kg with one decimal', () => {
    expect(mlPerKg(300, 6)).toBe(50);
    expect(mlPerKg(333, 6)).toBe(55.5);
    expect(mlPerKg(300, undefined)).toBeUndefined();
    expect(mlPerKg(300, 0)).toBeUndefined();
  });

  it('derives drunk amount and clamps at zero', () => {
    expect(drunkMl(200, 45)).toBe(155);
    expect(drunkMl(100, 120)).toBe(0);
  });
});

describe('stoolByDay', () => {
  it('counts, averages score and flags blood', () => {
    const entries = [
      entry({ type: 'stool', at: at('2026-09-10', '07:00'), data: { score: 3 } }),
      entry({ type: 'stool', at: at('2026-09-10', '18:00'), data: { score: 6, blood: true } }),
      entry({ type: 'stool', at: at('2026-09-09', '07:00'), data: {} }),
    ];
    const m = stoolByDay(entries, ['2026-09-09', '2026-09-10']);
    expect(m.get('2026-09-09')).toEqual({ count: 1, blood: false });
    expect(m.get('2026-09-10')).toEqual({ count: 2, blood: true, meanScore: 4.5 });
  });
});

describe('kg formatting', () => {
  it('keeps two decimals', () => {
    expect(fmtKg(6.2)).toBe('6.20');
    expect(fmtKg(6.255)).toBe('6.26');
    expect(roundKg(6.2549)).toBe(6.25);
  });
});

describe('weight helpers', () => {
  it('returns the latest weight and a per-day series', () => {
    const entries = [
      entry({ type: 'weight', at: at('2026-09-01', '09:00'), data: { kg: 6.2 } }),
      entry({ type: 'weight', at: at('2026-09-08', '09:00'), data: { kg: 6.0 } }),
      entry({ type: 'weight', at: at('2026-09-08', '21:00'), data: { kg: 5.9 } }),
    ];
    expect(latestWeightKg(entries, at('2026-09-10', '00:00'))).toBe(5.9);
    expect(latestWeightKg(entries, at('2026-09-05', '00:00'))).toBe(6.2);
    expect(weightSeries(entries)).toEqual([
      { day: '2026-09-01', kg: 6.2 },
      { day: '2026-09-08', kg: 5.9 },
    ]);
  });
});
