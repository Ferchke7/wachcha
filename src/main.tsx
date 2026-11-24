import { render } from 'preact';
import './styles.css';
import './media-center.css';
import './scrollbars.css';
import { App } from './App';
import { initializeCache } from './lib/cache-store';
import { isTauriRuntime } from './lib/desktop';
import { locale } from './lib/i18n';
import { appSettings } from './lib/playback-session';

async function bootstrap() {
  document.documentElement.lang = locale.value;
  document.documentElement.dataset.tv = appSettings.value.tvMode ? 'true' : 'false';
  document.documentElement.dataset.animations = appSettings.value.animations ? 'on' : 'off';

  await initializeCache();

  if (!isTauriRuntime() && 'serviceWorker' in navigator && import.meta.env.PROD) {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  }

  const root = document.getElementById('app');
  if (root) render(<App />, root);
}

void bootstrap();
