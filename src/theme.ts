// Theme preference: follow the device, or force light / dark.
// Stored per device in localStorage and applied as data-theme on <html>,
// which styles.css already understands.

export type ThemePref = 'system' | 'light' | 'dark';

const KEY = 'pethealth:theme';
const listeners = new Set<(t: ThemePref) => void>();

export function loadTheme(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function applyTheme(pref: ThemePref): void {
  const root = document.documentElement;
  if (pref === 'system') delete root.dataset.theme;
  else root.dataset.theme = pref;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    const bg = getComputedStyle(root).getPropertyValue('--accent').trim();
    if (bg) meta.setAttribute('content', bg);
  }
}

export function setTheme(pref: ThemePref): void {
  try {
    localStorage.setItem(KEY, pref);
  } catch {
    /* ignore */
  }
  applyTheme(pref);
  for (const l of listeners) l(pref);
}

export function onThemeChange(l: (t: ThemePref) => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export const THEME_LABEL: Record<ThemePref, string> = {
  system: '端末に合わせる',
  light: 'ライト',
  dark: 'ダーク',
};
