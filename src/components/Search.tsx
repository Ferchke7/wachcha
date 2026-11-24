import { useEffect, useState } from 'preact/hooks';
import { searchCatalog } from '~/lib/desktop';
import { locale, t } from '~/lib/i18n';
import type { MediaCategory, MediaItem } from '~/lib/types';
import { Button, ChoiceTabs, EmptyState, VirtualGrid } from '~/ui';
import { MediaCard } from './MediaCard';

const RECENT_KEY = 'wachcha:recent-searches';
type CatFilter = 'all' | MediaCategory;

function loadRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch {
    return [];
  }
}

export function Search({ initialQuery = '' }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState<CatFilter>('all');
  const [items, setItems] = useState<MediaItem[]>([]);
  const [recent, setRecent] = useState<string[]>(loadRecent);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialQuery) setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setItems([]);
      setLoading(false);
      return;
    }
    let alive = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchCatalog({
          text: trimmed,
          category: category === 'all' ? undefined : category,
          locale: locale.value,
        });
        if (!alive) return;
        setItems(res.items);
        const nextRecent = [trimmed, ...recent.filter(r => r !== trimmed)].slice(0, 8);
        setRecent(nextRecent);
        try {
          localStorage.setItem(RECENT_KEY, JSON.stringify(nextRecent));
        } catch {
          // Ignore storage quota errors.
        }
      } finally {
        if (alive) setLoading(false);
      }
    }, 260);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query, category, locale.value]);

  return (
    <section class="shelf-section">
      <h1 class="shelf-title" style={{ fontSize: '26px' }}>
        {t('search.title')}
      </h1>

      <div style={{ display: 'flex', gap: '10px', maxWidth: '720px' }}>
        <input
          type="search"
          class="input-field"
          data-search-input=""
          value={query}
          placeholder={t('search.placeholder')}
          aria-label={t('search.placeholder')}
          onInput={e => setQuery((e.target as HTMLInputElement).value)}
        />
        {query && (
          <Button variant="glass" onClick={() => setQuery('')}>
            ✕
          </Button>
        )}
      </div>

      <ChoiceTabs<CatFilter>
        ariaLabel="Search category filter"
        value={category}
        onChange={setCategory}
        options={[
          { value: 'all', label: t('cat.all') },
          { value: 'anime', label: t('cat.anime') },
          { value: 'turkish-dizi', label: t('cat.turkish-dizi') },
          { value: 'movie', label: t('cat.movie') },
          { value: 'series', label: t('cat.series') },
          { value: 'live-tv', label: t('cat.live-tv') },
        ]}
      />

      {!query.trim() && recent.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>
            {t('search.recent')}:
          </span>
          {recent.map(term => (
            <button key={term} type="button" class="choice-pill" onClick={() => setQuery(term)}>
              {term}
            </button>
          ))}
        </div>
      )}

      {!query.trim() ? (
        <EmptyState title={t('search.empty')} />
      ) : loading ? (
        <EmptyState title={t('search.searching')} />
      ) : items.length === 0 ? (
        <EmptyState title={t('search.noResults')} />
      ) : (
        <VirtualGrid
          items={items}
          itemKey={item => `${item.provider}:${item.id}`}
          renderItem={item => <MediaCard item={item} />}
        />
      )}
    </section>
  );
}
