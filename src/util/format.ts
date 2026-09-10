export function fmtTime(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const WEEKDAY = ['日', '月', '火', '水', '木', '金', '土'];

export function fmtDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${m}/${d}（${WEEKDAY[date.getDay()]}）`;
}

/** Value for <input type="datetime-local"> in local time. */
export function toDateTimeLocal(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function fromDateTimeLocal(v: string): number {
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : Date.now();
}
