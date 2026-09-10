import { useEffect, useState } from 'preact/hooks';
import { useSession } from '../hooks';

/** Renders a stored photo by path; shows a placeholder until resolved. */
export function Photo({ path, class: cls }: { path: string; class?: string }) {
  const { store } = useSession();
  const [url, setUrl] = useState<string | undefined>();
  useEffect(() => {
    let alive = true;
    void store?.photoUrl(path).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [store, path]);
  if (!url) return <div class={`photo placeholder ${cls ?? ''}`}>…</div>;
  return <img class={`photo ${cls ?? ''}`} src={url} alt="" loading="lazy" />;
}
