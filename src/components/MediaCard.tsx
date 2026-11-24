import { navigateTo } from '~/lib/navigation';
import type { MediaItem } from '~/lib/types';
import { CachedImage } from '~/ui';

export function MediaCard({ item, showRank = false }: { item: MediaItem; showRank?: boolean }) {
  const sourceLabel = item.badges[0] || item.provider;
  const qualityLabel =
    item.category === 'live-tv'
      ? 'LIVE · HLS'
      : item.episodesCount
        ? `${item.episodesCount} ep`
        : item.streamReady
          ? 'HD · HLS'
          : item.category.toUpperCase();

  const metaParts = [
    item.year ? String(item.year) : null,
    item.airingInfo || null,
    item.genres?.length ? item.genres.slice(0, 2).join(', ') : null,
    !item.genres?.length && item.audioLanguages.length
      ? item.audioLanguages.slice(0, 2).join('/')
      : null,
  ].filter(Boolean);

  const rankClass =
    item.rank === 1
      ? 'rank-badge rank-1'
      : item.rank === 2
        ? 'rank-badge rank-2'
        : item.rank === 3
          ? 'rank-badge rank-3'
          : 'rank-badge';

  return (
    <button
      type="button"
      class="media-card"
      data-nav-item=""
      onClick={() =>
        navigateTo(`/title/${encodeURIComponent(item.provider)}/${encodeURIComponent(item.id)}`)
      }
    >
      <div class="media-card-art">
        <CachedImage src={item.posterUrl} alt={item.title} />
        {showRank && item.rank != null ? (
          <span class={rankClass}>#{item.rank}</span>
        ) : (
          <span class="card-chip-tl">{sourceLabel}</span>
        )}
        {item.rating != null && <span class="card-chip-tr">★ {item.rating.toFixed(1)}</span>}
        <span class="card-chip-bl">{qualityLabel}</span>
        <div class="card-play-veil" aria-hidden="true">
          <span class="card-play-circle">▶</span>
        </div>
      </div>
      <div class="media-card-title">{item.title}</div>
      <div class="media-card-meta">{metaParts.join(' · ') || item.category}</div>
    </button>
  );
}
