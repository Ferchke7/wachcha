import { useState } from 'preact/hooks';
import { t } from '~/lib/i18n';
import { clearContinueHistory, continueEntries, libraryEntries } from '~/lib/library';
import { navigateTo } from '~/lib/navigation';
import type { WatchStatus } from '~/lib/types';
import { Button, ChoiceTabs, EmptyState } from '~/ui';
import { MediaCard } from './MediaCard';

type LibTab = 'all' | 'favorites' | WatchStatus;

export function Library() {
  const [tab, setTab] = useState<LibTab>('all');

  const filtered = libraryEntries.value.filter(entry => {
    if (tab === 'all') return true;
    if (tab === 'favorites') return entry.favorite;
    return entry.status === tab;
  });

  return (
    <section class="shelf-section">
      <div class="shelf-header">
        <h1 class="shelf-title" style={{ fontSize: '26px' }}>
          {t('library.title')}
        </h1>
        {continueEntries.value.length > 0 && (
          <Button variant="glass" onClick={() => clearContinueHistory()}>
            {t('library.clearHistory')}
          </Button>
        )}
      </div>

      <ChoiceTabs<LibTab>
        ariaLabel="Library tabs"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'all', label: t('cat.all') },
          { value: 'favorites', label: t('library.favorites') },
          { value: 'watching', label: t('detail.status.watching') },
          { value: 'planned', label: t('detail.status.planned') },
          { value: 'completed', label: t('detail.status.completed') },
        ]}
      />

      {filtered.length === 0 ? (
        <EmptyState
          title={t('library.empty')}
          action={
            <Button variant="primary" onClick={() => navigateTo('/search')}>
              ⌕ {t('nav.search')}
            </Button>
          }
        />
      ) : (
        <div class="poster-grid">
          {filtered.map(e => (
            <MediaCard
              key={e.mediaKey}
              item={{
                id: e.id,
                provider: e.provider,
                category: e.category,
                title: e.title,
                posterUrl: e.posterUrl,
                year: e.year,
                rating: e.rating,
                genres: [],
                badges: [e.status || (e.favorite ? '★' : e.provider)],
                audioLanguages: [],
                externalIds: {},
                streamReady: false,
                sources: [],
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}
