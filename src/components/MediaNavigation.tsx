import { t } from '~/lib/i18n';
import { navigateTo } from '~/lib/navigation';
import type { TranslationKey } from '~/lib/i18n';

export interface MediaNavigationProps {
  currentRoute: string;
  providerCount: number;
  nativeMpv: boolean;
}

const NAV_ITEMS: Array<{ route: string; labelKey: TranslationKey; icon: string }> = [
  { route: '/', labelKey: 'nav.home', icon: '⌂' },
  { route: '/catalog?category=movie', labelKey: 'nav.movies', icon: '🎬' },
  { route: '/catalog?category=turkish-dizi', labelKey: 'nav.dizis', icon: '📺' },
  { route: '/catalog?category=anime', labelKey: 'nav.anime', icon: '✦' },
  { route: '/search', labelKey: 'nav.search', icon: '⌕' },
  { route: '/library', labelKey: 'nav.library', icon: '★' },
  { route: '/sources', labelKey: 'nav.sources', icon: '⚡' },
  { route: '/settings', labelKey: 'nav.settings', icon: '⚙' },
];

export function MediaNavigation({ currentRoute, providerCount, nativeMpv }: MediaNavigationProps) {
  const isActive = (route: string) => {
    if (route === '/') return currentRoute === '/' || currentRoute === '';
    return currentRoute.startsWith(route);
  };

  return (
    <>
      <aside class="media-rail" aria-label="Main navigation">
        <div class="brand-lockup" onClick={() => navigateTo('/')}>
          <div class="brand-mark">▶</div>
          <div>
            <div class="brand-title">{t('brand.name')}</div>
            <div class="brand-sub">{t('brand.tagline')}</div>
          </div>
        </div>

        <nav class="nav-list">
          {NAV_ITEMS.map(item => (
            <button
              key={item.route}
              type="button"
              data-nav-item=""
              class={`nav-item${isActive(item.route) ? ' active' : ''}`}
              aria-current={isActive(item.route) ? 'page' : undefined}
              onClick={() => navigateTo(item.route)}
            >
              <span aria-hidden="true">{item.icon}</span>
              <span>{t(item.labelKey)}</span>
            </button>
          ))}
        </nav>

        <div class="rail-status-card">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            <span class="status-dot" />
            <span>{t('nav.providersOnline', { count: providerCount })}</span>
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--color-text-muted)' }}>
            AniLiberty · TMDB · TVMaze · Rutube · Stremio
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: 'var(--color-accent-soft)',
            }}
          >
            {nativeMpv ? 'ENGINE: libmpv + Shaka' : 'ENGINE: Shaka HLS/DASH'}
          </div>
        </div>
      </aside>

      <nav class="mobile-bottom-nav" aria-label="Mobile navigation">
        {[
          { route: '/', labelKey: 'nav.home' as TranslationKey },
          { route: '/catalog?category=turkish-dizi', labelKey: 'nav.dizis' as TranslationKey },
          { route: '/search', labelKey: 'nav.search' as TranslationKey },
          { route: '/library', labelKey: 'nav.library' as TranslationKey },
          { route: '/sources', labelKey: 'nav.sources' as TranslationKey },
        ].map(item => (
          <button
            key={item.route}
            type="button"
            class={`mobile-nav-btn${isActive(item.route) ? ' active' : ''}`}
            onClick={() => navigateTo(item.route)}
          >
            {t(item.labelKey)}
          </button>
        ))}
      </nav>
    </>
  );
}
