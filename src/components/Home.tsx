import { useEffect, useState } from 'preact/hooks';
import { peekCache, swrFetch } from '~/lib/cache-store';
import { getHomeShelves } from '~/lib/desktop';
import { locale, t, type TranslationKey } from '~/lib/i18n';
import { continueEntries, getLibraryEntry, toggleFavorite } from '~/lib/library';
import { navigateTo } from '~/lib/navigation';
import type { CatalogShelf, MediaCategory } from '~/lib/types';
import { Button, CachedImage, CardRowSkeleton, ChoiceTabs } from '~/ui';
import { MediaCard } from './MediaCard';

type FilterTab = 'all' | MediaCategory;

export function Home() {
  const activeLocale = locale.value;
  const cacheKey = `home-shelves:${activeLocale}`;
  const [shelves, setShelves] = useState<CatalogShelf[]>(
    () => peekCache<CatalogShelf[]>(cacheKey) || []
  );
  const [loading, setLoading] = useState(shelves.length === 0);
  const [vertical, setVertical] = useState<FilterTab>('all');

  useEffect(() => {
    let alive = true;
    const cached = peekCache<CatalogShelf[]>(cacheKey);
    if (cached) {
      setShelves(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }
    swrFetch(cacheKey, () => getHomeShelves(activeLocale))
      .then(data => {
        if (alive) {
          setShelves(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [activeLocale, cacheKey]);

  const featured = shelves.flatMap(s => s.items).find(i => i.streamReady) || shelves[0]?.items[0];
  const featuredLib = featured ? getLibraryEntry(featured.provider, featured.id) : undefined;
  const visibleShelves =
    vertical === 'all' ? shelves : shelves.filter(s => s.category === vertical);

  return (
    <>
      <section class="hero-banner" aria-label="Featured spotlight">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span class="hero-badge">{t('hero.badge')}</span>
            {featured?.rating != null && (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  color: 'var(--color-status-rating)',
                }}
              >
                ★ {featured.rating.toFixed(1)} {featured.year ? `· ${featured.year}` : ''}
              </span>
            )}
          </div>

          <h1 class="hero-title">{featured ? featured.title : t('hero.fallbackTitle')}</h1>
          <p class="hero-desc">{t('hero.fallbackDesc')}</p>

          <div class="hero-actions">
            {featured ? (
              <>
                <Button
                  variant="primary"
                  onClick={() =>
                    navigateTo(
                      `/title/${encodeURIComponent(featured.provider)}/${encodeURIComponent(featured.id)}`
                    )
                  }
                >
                  ▶ {t('hero.watchNow')}
                </Button>
                <Button variant="glass" onClick={() => toggleFavorite(featured)}>
                  {featuredLib?.favorite ? `★ ${t('hero.inWatchlist')}` : t('hero.addWatchlist')}
                </Button>
              </>
            ) : (
              <Button variant="primary" onClick={() => navigateTo('/search')}>
                ⌕ {t('nav.search')}
              </Button>
            )}
            <Button variant="glass" onClick={() => navigateTo('/sources')}>
              ⚡ {t('hero.exploreSources')}
            </Button>
          </div>
        </div>

        <div class="hero-poster-card">
          {featured && <CachedImage src={featured.posterUrl} alt={featured.title} />}
        </div>
      </section>

      <ChoiceTabs<FilterTab>
        ariaLabel="Content verticals"
        value={vertical}
        onChange={setVertical}
        options={[
          { value: 'all', label: t('cat.all') },
          { value: 'anime', label: t('cat.anime') },
          { value: 'turkish-dizi', label: t('cat.turkish-dizi') },
          { value: 'movie', label: t('cat.movie') },
          { value: 'series', label: t('cat.series') },
          { value: 'live-tv', label: t('cat.live-tv') },
        ]}
      />

      {continueEntries.value.length > 0 && (
        <section class="shelf-section">
          <div class="shelf-header">
            <div class="shelf-title-group">
              <h2 class="shelf-title">{t('shelf.continueWatching')}</h2>
              <span class="mono-badge">{t('shelf.continueSub')}</span>
            </div>
          </div>
          <div class="continue-row">
            {continueEntries.value.slice(0, 8).map(entry => {
              const pct =
                entry.duration > 0
                  ? Math.min(100, Math.round((entry.position / entry.duration) * 100))
                  : 0;
              const minsLeft = Math.max(1, Math.ceil((entry.duration - entry.position) / 60));
              return (
                <button
                  key={entry.mediaKey}
                  type="button"
                  data-nav-item=""
                  class="continue-card"
                  onClick={() =>
                    navigateTo(
                      `/watch/${encodeURIComponent(entry.provider)}/${encodeURIComponent(entry.id)}?ep=${encodeURIComponent(entry.episodeId)}`
                    )
                  }
                >
                  <div class="continue-thumb">
                    <CachedImage src={entry.posterUrl} alt={entry.title} />
                    <span class="card-chip-tr">{t('common.minutesLeft', { min: minsLeft })}</span>
                    <div class="continue-progress">
                      <div class="continue-progress-bar" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div class="media-card-title">{entry.title}</div>
                  <div class="media-card-meta">
                    {entry.episodeLabel} · {entry.voiceLabel}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {loading && shelves.length === 0 ? (
        <CardRowSkeleton count={6} />
      ) : (
        visibleShelves.map(shelf => (
          <section key={shelf.id} class="shelf-section">
            <div class="shelf-header">
              <div class="shelf-title-group">
                <h2 class="shelf-title">{t(shelf.titleKey as TranslationKey)}</h2>
                <span class="mono-badge">{shelf.providerBadge}</span>
              </div>
              <button
                type="button"
                class="btn btn-ghost"
                onClick={() => navigateTo(`/catalog?category=${shelf.category}`)}
              >
                {t('shelf.viewAll')}
              </button>
            </div>
            <div class="shelf-row">
              {shelf.items.map(item => (
                <MediaCard key={`${item.provider}:${item.id}`} item={item} />
              ))}
            </div>
          </section>
        ))
      )}
    </>
  );
}
