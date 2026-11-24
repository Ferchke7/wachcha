import { useEffect, useRef, useState } from 'preact/hooks';
import { getDesktopInfo, isTauriRuntime, listProviders } from '~/lib/desktop';
import { installKeyboardNavigation } from '~/lib/directional-navigation';
import { locale, setLocale, t } from '~/lib/i18n';
import {
  getScrollPosition,
  initNavigation,
  navigateBack,
  navigateTo,
  navState,
  saveScrollPosition,
} from '~/lib/navigation';
import type { DesktopInfo, Locale } from '~/lib/types';
import { Toast } from '~/ui';
import { Catalog } from './components/Catalog';
import { Detail } from './components/Detail';
import { Home } from './components/Home';
import { Library } from './components/Library';
import { MediaNavigation } from './components/MediaNavigation';
import { Schedule } from './components/Schedule';
import { Search } from './components/Search';
import { Settings } from './components/Settings';
import { Sources } from './components/Sources';
import { Tops } from './components/Tops';
import { UniversalPlayer } from './components/UniversalPlayer';

export function App() {
  const [providerCount, setProviderCount] = useState(7);
  const [desktop, setDesktop] = useState<DesktopInfo | null>(null);
  const [quickQuery, setQuickQuery] = useState('');
  const scrollRef = useRef<HTMLElement>(null);

  const refreshProviders = () => {
    void listProviders().then(list => setProviderCount(list.filter(p => p.enabled).length));
  };

  useEffect(() => {
    const stopNav = initNavigation();
    const stopKeys = installKeyboardNavigation();
    refreshProviders();
    void getDesktopInfo().then(setDesktop);
    return () => {
      stopNav();
      stopKeys();
    };
  }, []);

  const fullPath = navState.value.path;
  const [route, rawQuery = ''] = fullPath.split('?');
  const params = new URLSearchParams(rawQuery);

  // Restore scroll position on route change
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = getScrollPosition(fullPath);
    return () => saveScrollPosition(fullPath, el.scrollTop);
  }, [fullPath]);

  const watchMatch = /^\/watch\/([^/]+)\/([^/]+)$/.exec(route);
  if (watchMatch) {
    return (
      <>
        <UniversalPlayer
          provider={decodeURIComponent(watchMatch[1])}
          id={decodeURIComponent(watchMatch[2])}
          episodeId={params.get('ep') || undefined}
          voice={params.get('voice') || undefined}
        />
        <Toast />
      </>
    );
  }

  const titleMatch = /^\/title\/([^/]+)\/([^/]+)$/.exec(route);

  return (
    <div class="app-shell">
      <MediaNavigation
        currentRoute={fullPath}
        providerCount={providerCount}
        nativeMpv={Boolean(desktop?.nativeVideo.available)}
      />

      <div class="media-main">
        <header class="top-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
            <div class="nav-history-btns">
              <button
                type="button"
                class="icon-pill-btn"
                title={t('detail.back')}
                aria-label={t('detail.back')}
                onClick={() => navigateBack('/')}
              >
                ←
              </button>
              <button
                type="button"
                class="icon-pill-btn"
                title="Forward"
                aria-label="Forward"
                onClick={() => window.history.forward()}
              >
                →
              </button>
            </div>

            <form
              class="top-search-wrap"
              onSubmit={e => {
                e.preventDefault();
                navigateTo(`/search?q=${encodeURIComponent(quickQuery.trim())}`);
              }}
            >
              <input
                type="search"
                class="top-search-input"
                placeholder={t('search.placeholder')}
                aria-label={t('search.placeholder')}
                value={quickQuery}
                onInput={e => setQuickQuery((e.target as HTMLInputElement).value)}
              />
            </form>
          </div>

          <div class="top-right">
            <div class="locale-switch" role="group" aria-label={t('settings.language')}>
              {(['en', 'ru', 'tr'] as Locale[]).map(code => (
                <button
                  key={code}
                  type="button"
                  class={`locale-btn${locale.value === code ? ' active' : ''}`}
                  onClick={() => setLocale(code)}
                >
                  {code.toUpperCase()}
                </button>
              ))}
            </div>
            <span class="mono-badge">{isTauriRuntime() ? 'wachcha-media://' : 'v0.0.1 LIVE'}</span>
          </div>
        </header>

        <main class="media-scroll" ref={scrollRef}>
          {titleMatch ? (
            <Detail
              provider={decodeURIComponent(titleMatch[1])}
              id={decodeURIComponent(titleMatch[2])}
            />
          ) : route === '/tops' ? (
            <Tops initialVertical={params.get('vertical') || undefined} />
          ) : route === '/schedule' ? (
            <Schedule />
          ) : route === '/catalog' ? (
            <Catalog initialCategory={params.get('category') || undefined} />
          ) : route === '/search' ? (
            <Search initialQuery={params.get('q') || ''} />
          ) : route === '/library' ? (
            <Library />
          ) : route === '/sources' ? (
            <Sources onChanged={refreshProviders} />
          ) : route === '/settings' ? (
            <Settings />
          ) : (
            <Home />
          )}
        </main>
      </div>
      <Toast />
    </div>
  );
}
