import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartConfiguration,
} from 'chart.js';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useEntries, useSession } from '../hooks';
import {
  WATER_ML_PER_KG_NORMAL_HIGH,
  WATER_ML_PER_KG_NORMAL_LOW,
  WATER_ML_PER_KG_POLYDIPSIA,
  dayStart,
  lastDays,
  latestWeightKg,
  mlPerKg,
  stoolByDay,
  totalMl,
  waterByDay,
  weightSeries,
} from '../model/calc';
import { WATER_KIND_LABEL, type WaterKind } from '../model/entry';

Chart.register(
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
);

const DAY_MS = 24 * 60 * 60 * 1000;
const KIND_COLOR: Record<WaterKind, string> = {
  water: '#5b9bd5',
  milk: '#f2c94c',
  broth: '#e08a4a',
  other: '#a0a0a0',
};

function shortDay(key: string): string {
  const [, m, d] = key.split('-');
  return `${Number(m)}/${Number(d)}`;
}

export function Charts() {
  const { pet } = useSession();
  const [days, setDays] = useState(14);
  const keys = useMemo(() => lastDays(days), [days]);
  const from = dayStart(keys[0]);
  const to = dayStart(keys[keys.length - 1]) + DAY_MS;
  const entries = useEntries(from, to);
  const weightEntries = useEntries(from - 365 * DAY_MS, to);
  const weightKg = latestWeightKg(weightEntries) ?? pet?.currentWeightKg;

  const water = useMemo(() => waterByDay(entries, keys), [entries, keys]);
  const stool = useMemo(() => stoolByDay(entries, keys), [entries, keys]);
  const weights = useMemo(() => weightSeries(weightEntries), [weightEntries]);

  const waterCfg: ChartConfiguration = {
    type: 'bar',
    data: {
      labels: keys.map(shortDay),
      datasets: [
        ...(Object.keys(WATER_KIND_LABEL) as WaterKind[]).map((k) => ({
          label: WATER_KIND_LABEL[k],
          data: keys.map((d) => water.get(d)![k]),
          backgroundColor: KIND_COLOR[k],
          stack: 'ml',
          yAxisID: 'y',
        })),
        ...(weightKg
          ? [
              {
                type: 'line' as const,
                label: 'ml/kg',
                data: keys.map((d) => mlPerKg(totalMl(water.get(d)!), weightKg) ?? 0),
                borderColor: '#2f2a25',
                backgroundColor: '#2f2a25',
                yAxisID: 'y2',
                tension: 0.2,
              },
              refLine('目安 下限', WATER_ML_PER_KG_NORMAL_LOW, keys.length, '#8bc34a'),
              refLine('目安 上限', WATER_ML_PER_KG_NORMAL_HIGH, keys.length, '#8bc34a'),
              refLine('多飲ライン', WATER_ML_PER_KG_POLYDIPSIA, keys.length, '#c0392b'),
            ]
          : []),
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { stacked: true },
        y: { stacked: true, title: { display: true, text: 'ml' }, beginAtZero: true },
        ...(weightKg
          ? {
              y2: {
                position: 'right',
                title: { display: true, text: 'ml/kg' },
                beginAtZero: true,
                grid: { drawOnChartArea: false },
              },
            }
          : {}),
      },
    },
  };

  const stoolCfg: ChartConfiguration = {
    type: 'bar',
    data: {
      labels: keys.map(shortDay),
      datasets: [
        {
          label: '回数',
          data: keys.map((d) => stool.get(d)!.count),
          backgroundColor: keys.map((d) => (stool.get(d)!.blood ? '#c0392b' : '#b08968')),
          yAxisID: 'y',
        },
        {
          type: 'line' as const,
          label: '硬さ（平均）',
          data: keys.map((d) => stool.get(d)!.meanScore ?? null),
          borderColor: '#2f2a25',
          backgroundColor: '#2f2a25',
          yAxisID: 'y2',
          spanGaps: true,
          tension: 0.2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { title: { display: true, text: '回' }, beginAtZero: true, ticks: { stepSize: 1 } },
        y2: {
          position: 'right',
          min: 1,
          max: 7,
          title: { display: true, text: '硬さ' },
          grid: { drawOnChartArea: false },
        },
      },
    },
  };

  const weightCfg: ChartConfiguration = {
    type: 'line',
    data: {
      labels: weights.map((w) => shortDay(w.day)),
      datasets: [
        {
          label: 'kg',
          data: weights.map((w) => w.kg),
          borderColor: '#e08a4a',
          backgroundColor: '#e08a4a',
          tension: 0.2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { title: { display: true, text: 'kg' } } },
    },
  };

  return (
    <>
      <div class="rangetabs">
        {[7, 14, 30].map((n) => (
          <button key={n} type="button" class={days === n ? 'on' : ''} onClick={() => setDays(n)}>
            {n}日
          </button>
        ))}
      </div>

      <div class="card">
        <h3>飲水量（1日の合計）</h3>
        <div class="legend">
          {(Object.keys(WATER_KIND_LABEL) as WaterKind[]).map((k) => (
            <span key={k}>
              <i style={{ background: KIND_COLOR[k] }} />
              {WATER_KIND_LABEL[k]}
            </span>
          ))}
          {weightKg && (
            <span>
              <i style={{ background: '#2f2a25' }} />
              ml/kg（体重 {weightKg} kg）
            </span>
          )}
        </div>
        <ChartCanvas config={waterCfg} />
        {!weightKg && <div class="hint">体重を記録すると ml/kg と目安ラインが出ます。</div>}
      </div>

      <div class="card">
        <h3>便（回数と硬さ）</h3>
        <div class="hint">赤い棒＝血が混じった日</div>
        <ChartCanvas config={stoolCfg} />
      </div>

      <div class="card">
        <h3>体重</h3>
        {weights.length === 0 ? (
          <div class="hint">まだ体重の記録がありません。</div>
        ) : (
          <ChartCanvas config={weightCfg} />
        )}
      </div>
    </>
  );
}

function refLine(label: string, value: number, n: number, color: string) {
  return {
    type: 'line' as const,
    label,
    data: new Array(n).fill(value) as number[],
    borderColor: color,
    borderDash: [4, 4],
    borderWidth: 1,
    pointRadius: 0,
    yAxisID: 'y2',
  };
}

function ChartCanvas({ config }: { config: ChartConfiguration }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const chart = useRef<Chart>();
  useEffect(() => {
    if (!ref.current) return;
    chart.current?.destroy();
    chart.current = new Chart(ref.current, config);
    return () => chart.current?.destroy();
  }, [config]);
  return (
    <div class="chart">
      <canvas ref={ref} />
    </div>
  );
}
