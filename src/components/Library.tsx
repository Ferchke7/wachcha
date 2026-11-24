import { useState } from 'preact/hooks';
import { t } from '~/lib/i18n';
import {
  clearContinueHistory,
  continueEntries,
  getLibraryStats,
  libraryEntries,
} from '~/lib/library';
import { navigateTo } from '~/lib/navigation';
import type { WatchStatus } from '~/lib/types';
import { Button, CachedImage, ChoiceTabs, EmptyState } from '~/ui';
import { MediaCard } from './MediaCard';

type LibTab = 'all' | 'history' | 'favorites' | 'top_rated' | WatchStatus;

export function Library() {
  const [tab, setTab] = useState<LibTab>('all');
  const [query, setQuery] = useState('');
  const stats = getLibraryStats();

  const ql = query.trim().toLowerCase();

  const filtered = libraryEntries.value
    .filter(entry => {
      if (ql && !entry.title.toLowerCase().includes(ql)) return false;
      if (tab === 'all') return true;
      if (tab === 'favorites') return entry.favorite;
      if (tab === 'top_rated') return Boolean(entry.personalRating);
      return entry.status === tab;
    })
    .sort((a, b) => {
      if (tab === 'top_rated') return (b.personalRating || 0) - (a.personalRating || 0);
      return b.updatedAt - a.updatedAt;
    });

  return (
    <section class="shelf-section">
      <div class="shelf-header" style={{ flexWrap: 'wrap' }}>
        <h1 class="shelf-title" style={{ fontSize: '26px' }}>
          ★ {t('library.title')}
        </h1>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="search"
            class="input-field"
            style={{ width: '220px', padding: '7px 12px' }}
            placeholder={t('library.searchPlaceholder')}
            value={query}
            onInput={e => setQuery((e.target as HTMLInputElement).value)}
          />
          {continueEntries.value.length > 0 && (
            <Button variant="glass" onClick={() => clearContinueHistory()}>
              {t('library.clearHistory')}
            </Button>
          )}
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">{stats.totalTitles}</div>
          <div class="stat-label">{t('library.stats.titles')}</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{stats.watchedEpisodesCount}</div>
          <div class="stat-label">{t('library.stats.episodes')}</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{stats.estimatedHours}h</div>
          <div class="stat-label">{t('library.stats.hours')}</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{stats.averageRating ? `★ ${stats.averageRating}` : '—'}</div>
          <div class="stat-label">{t('library.stats.avgRating')}</div>
        </div>
      </div>

      {stats.topGenres.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {stats.topGenres.map(g => (
            <span key={g.name} class="mono-badge">
              {g.name} · {g.count}
            </span>
          ))}
        </div>
      )}

      <ChoiceTabs<LibTab>
        ariaLabel="Library tabs"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'all', label: `${t('cat.all')} (${stats.totalTitles})` },
          { value: 'history', label: `${t('library.history')} (${continueEntries.value.length})` },
          { value: 'top_rated', label: `${t('library.topRated')} (${stats.ratedCount})` },
          { value: 'favorites', label: `${t('library.favorites')} (${stats.favoritesCount})` },
          {
            value: 'watching',
            label: `${t('detail.status.watching')} (${stats.byStatus.watching})`,
          },
          { value: 'planned', label: `${t('detail.status.planned')} (${stats.byStatus.planned})` },
          {
            value: 'completed',
            label: `${t('detail.status.completed')} (${stats.byStatus.completed})`,
          },
          { value: 'on_hold', label: `${t('detail.status.on_hold')} (${stats.byStatus.on_hold})` },
        ]}
      />

      {tab === 'history' ? (
        continueEntries.value.length === 0 ? (
          <EmptyState
            title={t('library.empty')}
            action={
              <Button variant="primary" onClick={() => navigateTo('/tops')}>
                🏆 {t('nav.tops')}
              </Button>
            }
          />
        ) : (
          <div class="episode-grid">
            {continueEntries.value.map(entry => {
              const pct =
                entry.duration > 0
                  ? Math.min(100, Math.round((entry.position / entry.duration) * 100))
                  : 0;
              return (
                <button
                  key={entry.mediaKey}
                  type="button"
                  class="continue-card"
                  onClick={() =>
                    navigateTo(
                      `/watch/${encodeURIComponent(entry.provider)}/${encodeURIComponent(entry.id)}?ep=${encodeURIComponent(entry.episodeId)}&voice=${encodeURIComponent(entry.voiceLabel)}`
                    )
                  }
                >
                  <div class="continue-thumb">
                    <CachedImage src={entry.posterUrl} alt={entry.title} />
                    <div class="continue-progress">
                      <div class="continue-progress-bar" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div class="media-card-title">{entry.title}</div>
                  <div class="media-card-meta">
                    {entry.episodeLabel} · {entry.voiceLabel} · {pct}%
                  </div>
                </button>
              );
            })}
          </div>
        )
      ) : filtered.length === 0 ? (
        <EmptyState
          title={t('library.empty')}
          action={
            <Button variant="primary" onClick={() => navigateTo('/tops')}>
              🏆 {t('nav.tops')}
            </Button>
          }
        />
      ) : (
        <div class="poster-grid">
          {filtered.map((e, idx) => (
            <MediaCard
              key={e.mediaKey}
              showRank={tab === 'top_rated'}
              item={{
                id: e.id,
                provider: e.provider,
                category: e.category,
                title: e.title,
                posterUrl: e.posterUrl,
                year: e.year,
                rating: e.personalRating ?? e.rating,
                rank: tab === 'top_rated' ? idx + 1 : undefined,
                genres: e.genres || [],
                badges: [
                  e.personalRating
                    ? `★ ${e.personalRating}/10`
                    : e.status || (e.favorite ? '★' : e.provider),
                ],
                audioLanguages: [],
                externalIds: {},
                streamReady: true,
                sources: [],
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}
