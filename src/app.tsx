import { useRoute, useSession } from './hooks';
import { Charts } from './pages/Charts';
import { EntryForm } from './pages/EntryForm';
import { Home } from './pages/Home';
import { Settings } from './pages/Settings';

export function App() {
  const route = useRoute();
  const s = useSession();

  if (!s.ready) {
    return <div class="empty">読み込み中…</div>;
  }

  // Cloud mode: force sign-in and household/pet setup before anything else.
  const needsSetup = s.cloud && (!s.user || !s.household || !s.pet);
  const needsPet = !s.cloud && !s.pet;
  const page = needsSetup || needsPet ? 'settings' : route;

  let body;
  if (page.startsWith('entry/')) {
    body = <EntryForm route={page} />;
  } else if (page === 'charts') {
    body = <Charts />;
  } else if (page === 'settings') {
    body = <Settings />;
  } else {
    body = <Home />;
  }

  const tab = page.startsWith('entry/') ? 'home' : page;
  return (
    <>
      <header class="topbar">
        <div>
          {s.pet?.name ?? 'わんこ健康ノート'}
          {s.pet?.name && <div class="sub">わんこ健康ノート</div>}
        </div>
        {s.store && (
          <div class="sub" data-testid="mode">
            {s.store.mode === 'cloud' ? `👪 ${s.household?.name ?? ''}` : '📱 この端末のみ'}
          </div>
        )}
      </header>
      <main>{body}</main>
      <nav class="bottomnav">
        <a href="#/home" class={tab === 'home' ? 'active' : ''}>
          <span>🏠</span>記録
        </a>
        <a href="#/charts" class={tab === 'charts' ? 'active' : ''}>
          <span>📈</span>グラフ
        </a>
        <a href="#/settings" class={tab === 'settings' ? 'active' : ''}>
          <span>⚙️</span>設定
        </a>
      </nav>
    </>
  );
}
