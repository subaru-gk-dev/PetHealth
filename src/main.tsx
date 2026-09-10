import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app';
import { session } from './session';
import './styles.css';

registerSW({ immediate: true });
void session.start();

render(<App />, document.getElementById('app')!);
