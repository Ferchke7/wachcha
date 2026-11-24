import { navigateTo } from '~/lib/navigation';
import type { MediaItem } from '~/lib/types';
import { CachedImage } from '~/ui';

export function MediaCard({ item }: { item: MediaItem }) {
  const sourceLabel = item.badges[0] || item.provider;
  const qualityLabel = item.streamReady ? '1080p · HLS' : item.category.toUpperCase();
  const metaParts = [
    item.year ? String(item.year) : null,
    item.audioLanguages.length ? item.audioLanguages.slice(0, 2).join('/') : null,
    item.sources.length > 1 ? `${item.sources.length} src` : null,
  ].filter(Boolean);

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
        <span class="card-chip-tl">{sourceLabel}</span>
        {item.rating != null && <span class="card-chip-tr">★ {item.rating.toFixed(1)}</span>}
        <span class="card-chip-bl">{qualityLabel}</span>
      </div>
      <div class="media-card-title">{item.title}</div>
      <div class="media-card-meta">{metaParts.join(' · ') || item.category}</div>
    </button>
  );
}
