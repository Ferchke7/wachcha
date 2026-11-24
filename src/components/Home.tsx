import { useEffect, useState } from 'preact/hooks';
import { peekCache, swrFetch } from '~/lib/cache-store';
import { getHomeShelves } from '~/lib/desktop';
import { locale, t, type TranslationKey } from '~/lib/i18n';
import {
  continueEntries,
  getLibraryEntry,
  removeContinueEntry,
  toggleFavorite,
} from '~/lib/library';
import { navigateTo } from '~/lib/navigation';
import type { CatalogShelf, MediaCategory, MediaItem } from '~/lib/types';
import { Button, CachedImage, CardRowSkeleton, ChoiceTabs } from '~/ui';
import { MediaCard } from './MediaCard';

type FilterTab = 'all' | MediaCategory;

const SHELF_TO_TOPS: Record<string, string> = {
  'top-anime': '/tops?vertical=anime',
  'trending-anime': '/tops?vertical=ongoing',
  'shikimori-top': '/tops?vertical=shikimori',
  'top-movies': '/tops?vertical=movie',
  'top-series': '/tops?vertical=series',
  'turkish-dizis': '/tops?vertical=turkish-dizi',
  'russian-cinema': '/tops?vertical=russian',
  'live-tv': '/tops?vertical=live-tv',
};

export function Home() {
  const activeLocale = locale.value;
  const cacheKey = `home-shelves-v2:${activeLocale}`;
  const [shelves, setShelves] = useState<CatalogShelf[]>(
    () => peekCache<CatalogShelf[]>(cacheKey) || []
  );
  const [loading, setLoading] = useState(shelves.length === 0);
  const [vertical, setVertical] = useState<FilterTab>('all');
  const [heroIdx, setHeroIdx] = useState(0);

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

  const spotlightCandidates: MediaItem[] = [];
  for (const shelf of shelves) {
    const pick = shelf.items.find(i => i.posterUrl && i.streamReady) || shelf.items[0];
    if (pick && spotlightCandidates.length < 5) {
      spotlightCandidates.push(pick);
    }
  }

  useEffect(() => {
    if (spotlightCandidates.length <= 1) return;
    const timer = window.setInterval(() => {
      setHeroIdx(i => (i + 1) % spotlightCandidates.length);
    }, 9000);
    return () => window.clearInterval(timer);
  }, [spotlightCandidates.length]);

  const featured = spotlightCandidates[heroIdx % Math.max(1, spotlightCandidates.length)];
  const featuredLib = featured ? getLibraryEntry(featured.provider, featured.id) : undefined;
  const visibleShelves =
    vertical === 'all' ? shelves : shelves.filter(s => s.category === vertical);

  return (
    <>
      <section class="hero-banner" aria-label="Featured spotlight">
        {featured?.backdropUrl && (
          <div
            class="hero-bg-layer"
            style={{ backgroundImage: `url("${featured.backdropUrl}")` }}
          />
        )}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span class="hero-badge">{t('hero.badge')}</span>
            {featured?.rating != null && (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: 'var(--color-status-rating)',
                }}
              >
                ★ {featured.rating.toFixed(1)}
              </span>
            )}
            {featured?.year && <span class="mono-badge">{featured.year}</span>}
            {featured?.episodesCount && (
              <span class="mono-badge">
                {t('common.episodesCount', { count: featured.episodesCount })}
              </span>
            )}
            {featured?.genres.slice(0, 3).map(g => (
              <span key={g} class="mono-badge">
                {g}
              </span>
            ))}
          </div>

          <h1 class="hero-title">{featured ? featured.title : t('hero.fallbackTitle')}</h1>
          <p class="hero-desc">{featured?.synopsis || t('hero.fallbackDesc')}</p>

          <div class="hero-actions">
            {featured ? (
              <>
                <Button
                  variant="primary"
                  onClick={() =>
                    navigateTo(
                      `/watch/${encodeURIComponent(featured.provider)}/${encodeURIComponent(featured.id)}`
                    )
                  }
                >
                  ▶ {t('hero.watchNow')}
                </Button>
                <Button
                  variant="glass"
                  onClick={() =>
                    navigateTo(
                      `/title/${encodeURIComponent(featured.provider)}/${encodeURIComponent(featured.id)}`
                    )
                  }
                >
                  ⓘ {t('hero.details')}
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
            <Button variant="glass" onClick={() => navigateTo('/tops')}>
              🏆 {t('nav.tops')}
            </Button>
          </div>

          {spotlightCandidates.length > 1 && (
            <div class="hero-dots" role="tablist" aria-label="Spotlight slides">
              {spotlightCandidates.map((cand, idx) => (
                <button
                  key={`${cand.provider}:${cand.id}`}
                  type="button"
                  aria-label={cand.title}
                  class={`hero-dot${idx === heroIdx % spotlightCandidates.length ? ' active' : ''}`}
                  onClick={() => setHeroIdx(idx)}
                />
              ))}
            </div>
          )}
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
            {continueEntries.value.slice(0, 10).map(entry => {
              const pct =
                entry.duration > 0
                  ? Math.min(100, Math.round((entry.position / entry.duration) * 100))
                  : 0;
              const minsLeft = Math.max(1, Math.ceil((entry.duration - entry.position) / 60));
              return (
                <div key={entry.mediaKey} class="continue-card" style={{ position: 'relative' }}>
                  <button
                    type="button"
                    data-nav-item=""
                    style={{
                      background: 'transparent',
                      border: 0,
                      padding: 0,
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                    onClick={() =>
                      navigateTo(
                        `/watch/${encodeURIComponent(entry.provider)}/${encodeURIComponent(entry.id)}?ep=${encodeURIComponent(entry.episodeId)}&voice=${encodeURIComponent(entry.voiceLabel)}`
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
                  <button
                    type="button"
                    aria-label="Remove from continue watching"
                    style={{
                      position: 'absolute',
                      top: '14px',
                      left: '14px',
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      border: 0,
                      background: 'rgba(9,6,18,0.78)',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                    onClick={() => removeContinueEntry(entry.provider, entry.id)}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {loading && shelves.length === 0 ? (
        <CardRowSkeleton count={6} />
      ) : (
        visibleShelves.map(shelf => {
          const isRanked =
            shelf.id === 'top-anime' ||
            shelf.id === 'shikimori-top' ||
            shelf.id === 'top-movies' ||
            shelf.id === 'turkish-dizis';
          return (
            <section key={shelf.id} class="shelf-section">
              <div class="shelf-header">
                <div class="shelf-title-group">
                  <h2 class="shelf-title">{t(shelf.titleKey as TranslationKey)}</h2>
                  <span class="mono-badge">{shelf.providerBadge}</span>
                </div>
                <button
                  type="button"
                  class="btn btn-ghost"
                  onClick={() =>
                    navigateTo(SHELF_TO_TOPS[shelf.id] || `/catalog?category=${shelf.category}`)
                  }
                >
                  {t('shelf.viewAll')}
                </button>
              </div>
              <div class="shelf-row">
                {shelf.items.map(item => (
                  <MediaCard key={`${item.provider}:${item.id}`} item={item} showRank={isRanked} />
                ))}
              </div>
            </section>
          );
        })
      )}
    </>
  );
}
