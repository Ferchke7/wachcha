import { useEffect, useState } from 'preact/hooks';
import { getCatalog, getGenres } from '~/lib/desktop';
import { t } from '~/lib/i18n';
import { navigateTo } from '~/lib/navigation';
import type { GenreOption, MediaCategory, MediaItem, SortMode } from '~/lib/types';
import { Button, CardRowSkeleton, ChoiceTabs, EmptyState, VirtualGrid } from '~/ui';
import { MediaCard } from './MediaCard';

type CatFilter = 'all' | MediaCategory;

const YEARS = ['2026', '2025', '2024', '2023', '2022', '2021', '2020', '2019', '2018', '2015'];

export function Catalog({ initialCategory }: { initialCategory?: string }) {
  const validCat = (raw?: string): CatFilter =>
    raw === 'movie' ||
    raw === 'series' ||
    raw === 'turkish-dizi' ||
    raw === 'anime' ||
    raw === 'live-tv'
      ? raw
      : 'all';

  const [category, setCategory] = useState<CatFilter>(validCat(initialCategory));
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
    setCategory(validCat(initialCategory));
  }, [initialCategory]);

  useEffect(() => {
    let alive = true;
    void getGenres(category === 'all' ? 'anime' : category).then(list => {
      if (alive) setGenres(list);
    });
    return () => {
      alive = false;
    };
  }, [category]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setPage(1);
    getCatalog({
      category,
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
  }, [category, sort, genre, year, minRating]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const res = await getCatalog({
        category,
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

  const handleCategoryChange = (next: CatFilter) => {
    setCategory(next);
    setGenre('');
    setYear('');
    navigateTo(next === 'all' ? '/catalog' : `/catalog?category=${next}`);
  };

  return (
    <section class="shelf-section">
      <div class="shelf-header">
        <h1 class="shelf-title" style={{ fontSize: '26px' }}>
          {category === 'all' ? t('cat.all') : t(`cat.${category}`)}
        </h1>
        <span class="mono-badge">{items.length}</span>
      </div>

      <ChoiceTabs<CatFilter>
        ariaLabel="Catalog vertical filter"
        value={category}
        onChange={handleCategoryChange}
        options={[
          { value: 'all', label: t('cat.all') },
          { value: 'anime', label: t('cat.anime') },
          { value: 'turkish-dizi', label: t('cat.turkish-dizi') },
          { value: 'movie', label: t('cat.movie') },
          { value: 'series', label: t('cat.series') },
          { value: 'live-tv', label: t('cat.live-tv') },
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
            renderItem={item => <MediaCard item={item} />}
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
