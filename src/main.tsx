import { render } from 'preact';
import { App } from './app';
import { session } from './session';
import './styles.css';

// The service worker only exists in a real deployment (Hosting / Pages).
// When the page is served from somewhere else (e.g. a preview page) the
// registration fails and we simply carry on without offline caching.
if (!import.meta.env.VITE_NO_SW && 'serviceWorker' in navigator) {
  import('virtual:pwa-register')
    .then(({ registerSW }) => registerSW({ immediate: true, onRegisterError: () => undefined }))
    .catch(() => undefined);
}

void session.start();

render(<App />, document.getElementById('app')!);
