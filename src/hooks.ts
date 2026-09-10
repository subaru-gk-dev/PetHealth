import { useEffect, useState } from 'preact/hooks';
import type { Entry } from './model/entry';
import { session, type SessionState } from './session';

export function useSession(): SessionState {
  const [state, setState] = useState(session.state);
  useEffect(() => session.subscribe(setState), []);
  return state;
}

/** Live entries for the active pet within [fromMs, toMs). */
export function useEntries(fromMs: number, toMs: number): Entry[] {
  const { store, pet } = useSession();
  const [entries, setEntries] = useState<Entry[]>([]);
  useEffect(() => {
    if (!store || !pet) {
      setEntries([]);
      return;
    }
    return store.watchEntries(pet.id, fromMs, toMs, setEntries);
  }, [store, pet?.id, fromMs, toMs]);
  return entries;
}

/** Minimal hash router: returns the current route string after '#/'. */
export function useRoute(): string {
  const read = () => location.hash.replace(/^#\/?/, '') || 'home';
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const onChange = () => setRoute(read());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function navigate(route: string): void {
  location.hash = `#/${route}`;
}
