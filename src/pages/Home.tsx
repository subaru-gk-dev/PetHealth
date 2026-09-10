import { useMemo, useState } from 'preact/hooks';
import { Photo } from '../components/Photo';
import { navigate, useEntries, useSession } from '../hooks';
import {
  dayKey,
  dayStart,
  emptyWaterByKind,
  latestWeightKg,
  mlPerKg,
  sortNewestFirst,
  totalMl,
  waterByDay,
} from '../model/calc';
import {
  ENTRY_ICON,
  ENTRY_LABEL,
  WATER_KIND_LABEL,
  type Entry,
  type EntryType,
  type MealData,
  type MedData,
  type StoolData,
  type UrineData,
  type VitalData,
  type VomitData,
  type WaterData,
  type WeightData,
} from '../model/entry';
import { fmtDay, fmtTime } from '../util/format';

const QUICK: EntryType[] = ['stool', 'water', 'meal', 'urine', 'med', 'note'];
const DAY_MS = 24 * 60 * 60 * 1000;

export function Home() {
  const { pet } = useSession();
  const [day, setDay] = useState(() => dayKey(Date.now()));
  const from = dayStart(day);
  const to = from + DAY_MS;
  const entries = useEntries(from, to);
  // Weight may have been recorded on an earlier day; look back 90 days.
  const weightEntries = useEntries(from - 90 * DAY_MS, to);

  const sorted = useMemo(() => sortNewestFirst(entries), [entries]);
  const water = waterByDay(entries, [day]).get(day) ?? emptyWaterByKind();
  const waterTotal = totalMl(water);
  const weightKg = latestWeightKg(weightEntries, to) ?? pet?.currentWeightKg;
  const perKg = mlPerKg(waterTotal, weightKg);
  const stoolCount = entries.filter((e) => e.type === 'stool').length;
  const mealCount = entries.filter((e) => e.type === 'meal').length;
  const isToday = day === dayKey(Date.now());

  return (
    <>
      <div class="quick">
        {QUICK.map((t) => (
          <button key={t} type="button" onClick={() => navigate(`entry/new/${t}`)}>
            <span>{ENTRY_ICON[t]}</span>
            {ENTRY_LABEL[t]}
          </button>
        ))}
      </div>

      <div class="daynav">
        <button type="button" onClick={() => setDay(dayKey(from - DAY_MS))} aria-label="前の日">
          ‹
        </button>
        <div>{isToday ? `今日 ${fmtDay(day)}` : fmtDay(day)}</div>
        <button
          type="button"
          onClick={() => setDay(dayKey(from + DAY_MS))}
          disabled={isToday}
          aria-label="次の日"
        >
          ›
        </button>
      </div>

      <div class="summary" data-testid="summary">
        <div>
          飲水 <b>{waterTotal} ml</b>
          {perKg !== undefined && <> （{perKg} ml/kg）</>}
        </div>
        <div>
          便 <b>{stoolCount} 回</b>
        </div>
        <div>
          食事 <b>{mealCount} 回</b>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div class="empty">この日の記録はまだありません。上のボタンで記録できます。</div>
      ) : (
        <ul class="timeline" data-testid="timeline">
          {sorted.map((e) => (
            <li key={e.id} onClick={() => navigate(`entry/${e.id}`)}>
              <div class="time">{fmtTime(e.at)}</div>
              <div>
                <div class="title">
                  {ENTRY_ICON[e.type]} {ENTRY_LABEL[e.type]}
                </div>
                <div class="detail">{describe(e)}</div>
                {e.note && <div class="note">{e.note}</div>}
                {e.photoPaths.length > 0 && (
                  <div class="thumbs">
                    {e.photoPaths.map((p) => (
                      <Photo key={p} path={p} />
                    ))}
                  </div>
                )}
              </div>
              <div class="who">{e.createdByName ?? ''}</div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

const STOOL_COLOR: Record<string, string> = {
  brown: '茶',
  dark: '濃い茶',
  light: '薄い',
  yellow: '黄',
  green: '緑',
  black: '黒',
  red: '赤',
};
const AMOUNT: Record<string, string> = { small: '少', normal: '普通', large: '多' };
const URINE_COLOR: Record<string, string> = {
  pale: '薄い',
  normal: '普通',
  dark: '濃い',
  bloody: '血尿',
};
const LEFTOVER: Record<string, string> = { none: '完食', half: '半分残し', most: 'ほぼ残し' };
const VOMIT: Record<string, string> = { food: '食べ物', foam: '泡', bile: '黄色い液', other: 'その他' };

/** One-line human summary of an entry for the timeline. */
export function describe(e: Entry): string {
  switch (e.type) {
    case 'stool': {
      const d = e.data as StoolData;
      const parts: string[] = [];
      if (d.score) parts.push(`硬さ ${d.score}`);
      if (d.color) parts.push(STOOL_COLOR[d.color]);
      if (d.amount) parts.push(`量 ${AMOUNT[d.amount]}`);
      if (d.blood) parts.push('血あり');
      if (d.mucus) parts.push('粘液あり');
      return parts.join('・');
    }
    case 'urine': {
      const d = e.data as UrineData;
      const parts: string[] = [];
      if (d.color) parts.push(URINE_COLOR[d.color]);
      if (d.amount) parts.push(`量 ${AMOUNT[d.amount]}`);
      return parts.join('・');
    }
    case 'water': {
      const d = e.data as WaterData;
      let s = `${WATER_KIND_LABEL[d.kind]} ${d.ml} ml`;
      if (d.milkMl !== undefined || d.waterMl !== undefined) {
        s += `（ミルク ${d.milkMl ?? 0} + 水 ${d.waterMl ?? 0}）`;
      }
      return s;
    }
    case 'meal': {
      const d = e.data as MealData;
      const parts: string[] = [];
      if (d.food) parts.push(d.food);
      if (d.grams !== undefined) parts.push(`${d.grams} g`);
      if (d.leftover) parts.push(LEFTOVER[d.leftover]);
      if (d.appetite) parts.push(`食欲 ${d.appetite}/5`);
      if (d.treat) parts.push('おやつ');
      if (d.therapeutic) parts.push('療法食');
      return parts.join('・');
    }
    case 'med': {
      const d = e.data as MedData;
      return `${d.name}${d.dose ? ` ${d.dose}` : ''} ${d.given ? '✓ 済' : '未'}`;
    }
    case 'weight':
      return `${(e.data as WeightData).kg} kg`;
    case 'vital': {
      const d = e.data as VitalData;
      const parts: string[] = [];
      if (d.tempC !== undefined) parts.push(`体温 ${d.tempC}℃`);
      if (d.rrPerMin !== undefined) parts.push(`呼吸 ${d.rrPerMin}/分`);
      if (d.hrPerMin !== undefined) parts.push(`心拍 ${d.hrPerMin}/分`);
      return parts.join('・');
    }
    case 'vomit': {
      const d = e.data as VomitData;
      const parts: string[] = [];
      if (d.content) parts.push(VOMIT[d.content]);
      if (d.count) parts.push(`${d.count} 回`);
      return parts.join('・');
    }
    case 'vet': {
      const d = e.data as import('../model/entry').VetData;
      const parts: string[] = [];
      if (d.clinic) parts.push(d.clinic);
      if (d.diagnosis) parts.push(d.diagnosis);
      if (d.labs) parts.push(Object.entries(d.labs).map(([k, v]) => `${k} ${v}`).join(' '));
      return parts.join('・');
    }
    default:
      return '';
  }
}
