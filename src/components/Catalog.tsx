import { useEffect, useState } from 'preact/hooks';
import { getHomeShelves, searchCatalog } from '~/lib/desktop';
import { locale, t } from '~/lib/i18n';
import { navigateTo } from '~/lib/navigation';
import type { MediaCategory, MediaItem } from '~/lib/types';
import { CardRowSkeleton, ChoiceTabs, EmptyState, VirtualGrid } from '~/ui';
import { MediaCard } from './MediaCard';

type CatFilter = 'all' | MediaCategory;

const SEED_QUERIES: Record<MediaCategory, string> = {
  anime: 'a',
  'turkish-dizi': 'dizi',
  movie: 'кино',
  series: 'the',
  'live-tv': 'tv',
};

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
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setCategory(validCat(initialCategory));
  }, [initialCategory]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const run = async () => {
      try {
        if (category === 'all') {
          const shelves = await getHomeShelves(locale.value);
          if (alive) setItems(shelves.flatMap(s => s.items));
        } else {
          const res = await searchCatalog({
            text: SEED_QUERIES[category],
            category,
            locale: locale.value,
          });
          if (alive) setItems(res.items);
        }
      } catch {
        if (alive) setItems([]);
      } finally {
        if (alive) setLoading(false);
      }
    };
    run();
    return () => {
      alive = false;
    };
  }, [category, locale.value]);

  const handleCategoryChange = (next: CatFilter) => {
    setCategory(next);
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

      {loading ? (
        <CardRowSkeleton count={8} />
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
