import { useEffect, useState } from 'preact/hooks';
import { getGenres, getTops } from '~/lib/desktop';
import { t } from '~/lib/i18n';
import { navigateTo } from '~/lib/navigation';
import type { GenreOption, MediaItem, SortMode, TopsVertical } from '~/lib/types';
import { Button, CardRowSkeleton, ChoiceTabs, EmptyState, VirtualGrid } from '~/ui';
import { MediaCard } from './MediaCard';

const VALID_VERTICALS: TopsVertical[] = [
  'anime',
  'shikimori',
  'ongoing',
  'movie',
  'series',
  'turkish-dizi',
  'russian',
  'live-tv',
];

const YEARS = ['2026', '2025', '2024', '2023', '2022', '2021', '2020', '2019', '2015', '2010'];

export function Tops({ initialVertical }: { initialVertical?: string }) {
  const parseVertical = (raw?: string): TopsVertical =>
    VALID_VERTICALS.includes(raw as TopsVertical) ? (raw as TopsVertical) : 'anime';

  const [vertical, setVertical] = useState<TopsVertical>(parseVertical(initialVertical));
  const [sort, setSort] = useState<SortMode>('rating');
  const [genre, setGenre] = useState('');
  const [year, setYear] = useState('');
  const [minRating, setMinRating] = useState(0);
  const [genres, setGenres] = useState<GenreOption[]>([]);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    setVertical(parseVertical(initialVertical));
  }, [initialVertical]);

  useEffect(() => {
    let alive = true;
    void getGenres(vertical).then(list => {
      if (alive) setGenres(list);
    });
    return () => {
      alive = false;
    };
  }, [vertical]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setPage(1);
    getTops({
      vertical,
      page: 1,
      sort,
      genre: genre || undefined,
      year: year || undefined,
      minRating,
    })
      .then(res => {
        if (!alive) return;
        setItems(res.items);
        setHasMore(res.hasMore);
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setItems([]);
        setHasMore(false);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [vertical, sort, genre, year, minRating]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const res = await getTops({
        vertical,
        page: nextPage,
        sort,
        genre: genre || undefined,
        year: year || undefined,
        minRating,
      });
      setItems(prev => {
        const seen = new Set(prev.map(i => `${i.provider}:${i.id}`));
        const fresh = res.items.filter(i => !seen.has(`${i.provider}:${i.id}`));
        return [...prev, ...fresh];
      });
      setPage(nextPage);
      setHasMore(res.hasMore);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleVerticalChange = (next: TopsVertical) => {
    setVertical(next);
    setGenre('');
    setYear('');
    navigateTo(`/tops?vertical=${next}`);
  };

  return (
    <section class="shelf-section">
      <div class="shelf-header">
        <div>
          <h1 class="shelf-title" style={{ fontSize: '26px' }}>
            🏆 {t('tops.title')}
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--color-text-muted)', fontSize: '13px' }}>
            {t('tops.subtitle')}
          </p>
        </div>
        <span class="mono-badge">{items.length}</span>
      </div>

      <ChoiceTabs<TopsVertical>
        ariaLabel="Top rankings vertical"
        value={vertical}
        onChange={handleVerticalChange}
        options={[
          { value: 'anime', label: t('tops.tab.anime') },
          { value: 'shikimori', label: t('tops.tab.shikimori') },
          { value: 'ongoing', label: t('tops.tab.ongoing') },
          { value: 'movie', label: t('tops.tab.movie') },
          { value: 'series', label: t('tops.tab.series') },
          { value: 'turkish-dizi', label: t('tops.tab.turkish-dizi') },
          { value: 'russian', label: t('tops.tab.russian') },
          { value: 'live-tv', label: t('tops.tab.live-tv') },
        ]}
      />

      <div class="filter-bar">
        <label class="filter-group">
          <span class="filter-label">{t('filters.sort')}</span>
          <select
            class="filter-select"
            value={sort}
            onChange={e => setSort((e.target as HTMLSelectElement).value as SortMode)}
          >
            <option value="rating">{t('filters.sort.rating')}</option>
            <option value="popular">{t('filters.sort.popular')}</option>
            <option value="newest">{t('filters.sort.newest')}</option>
            <option value="year">{t('filters.sort.year')}</option>
          </select>
        </label>

        {genres.length > 0 && (
          <label class="filter-group">
            <span class="filter-label">{t('filters.genre')}</span>
            <select
              class="filter-select"
              value={genre}
              onChange={e => setGenre((e.target as HTMLSelectElement).value)}
            >
              <option value="">{t('filters.allGenres')}</option>
              {genres.map(g => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label class="filter-group">
          <span class="filter-label">{t('filters.year')}</span>
          <select
            class="filter-select"
            value={year}
            onChange={e => setYear((e.target as HTMLSelectElement).value)}
          >
            <option value="">{t('filters.allYears')}</option>
            {YEARS.map(y => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>

        <label class="filter-group">
          <span class="filter-label">{t('filters.minRating')}</span>
          <select
            class="filter-select"
            value={String(minRating)}
            onChange={e => setMinRating(Number((e.target as HTMLSelectElement).value))}
          >
            <option value="0">{t('filters.anyRating')}</option>
            <option value="7">★ 7.0+</option>
            <option value="8">★ 8.0+</option>
            <option value="8.5">★ 8.5+</option>
          </select>
        </label>

        {(genre || year || minRating > 0 || sort !== 'rating') && (
          <Button
            variant="ghost"
            onClick={() => {
              setGenre('');
              setYear('');
              setMinRating(0);
              setSort('rating');
            }}
          >
            {t('filters.reset')}
          </Button>
        )}
      </div>

      {loading ? (
        <CardRowSkeleton count={8} />
      ) : items.length === 0 ? (
        <EmptyState title={t('search.noResults')} />
      ) : (
        <>
          <VirtualGrid
            items={items}
            itemKey={item => `${item.provider}:${item.id}`}
            renderItem={item => <MediaCard item={item} showRank />}
          />
          {hasMore && (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '12px' }}>
              <Button variant="primary" disabled={loadingMore} onClick={() => void loadMore()}>
                {loadingMore ? t('common.loading') : `${t('tops.loadMore')} →`}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
