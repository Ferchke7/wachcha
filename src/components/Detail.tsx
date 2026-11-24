import { useEffect, useState } from 'preact/hooks';
import { getMediaDetail } from '~/lib/desktop';
import { locale, t } from '~/lib/i18n';
import {
  getContinueEntry,
  getLibraryEntry,
  isEpisodeWatched,
  setPersonalRating,
  setWatchStatus,
  toggleFavorite,
} from '~/lib/library';
import { navigateBack, navigateTo } from '~/lib/navigation';
import { formatTime } from '~/lib/playback-session';
import type { MediaDetail, WatchStatus } from '~/lib/types';
import { Button, CachedImage, ChoiceTabs, EmptyState, Skeleton } from '~/ui';
import { MediaCard } from './MediaCard';

export function Detail({ provider, id }: { provider: string; id: string }) {
  const [detail, setDetail] = useState<MediaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [epFilter, setEpFilter] = useState('');
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [trailerOpen, setTrailerOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    setEpFilter('');
    setLightboxIdx(null);
    setTrailerOpen(false);
    getMediaDetail(provider, id, locale.value)
      .then(data => {
        if (!alive) return;
        setDetail(data);
        setSelectedVoice(data.voices[0] || '');
        const seasons = [...new Set(data.episodes.map(e => e.season))].sort((a, b) => a - b);
        setSelectedSeason(seasons[0] || 1);
        setLoading(false);
      })
      .catch(err => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [provider, id, locale.value]);

  const shots = detail?.screenshots || [];

  useEffect(() => {
    if (lightboxIdx === null && !trailerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxIdx(null);
        setTrailerOpen(false);
      } else if (lightboxIdx !== null && e.key === 'ArrowRight' && shots.length > 0) {
        setLightboxIdx((lightboxIdx + 1) % shots.length);
      } else if (lightboxIdx !== null && e.key === 'ArrowLeft' && shots.length > 0) {
        setLightboxIdx((lightboxIdx - 1 + shots.length) % shots.length);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIdx, trailerOpen, shots.length]);

  if (loading) return <Skeleton height={360} />;
  if (error || !detail) {
    return (
      <EmptyState
        title={error || t('common.error')}
        action={<Button onClick={() => navigateBack('/')}>← {t('detail.back')}</Button>}
      />
    );
  }

  const { item, episodes } = detail;
  const lib = getLibraryEntry(item.provider, item.id);
  const resume = getContinueEntry(item.provider, item.id);
  const seasons = [...new Set(episodes.map(e => e.season))].sort((a, b) => a - b);

  const visibleEpisodes = episodes.filter(ep => {
    if (seasons.length > 1 && ep.season !== selectedSeason) return false;
    if (epFilter.trim()) {
      const q = epFilter.trim().toLowerCase();
      return (
        String(ep.number).includes(q) ||
        ep.title.toLowerCase().includes(q) ||
        `s${ep.season}e${ep.number}`.includes(q)
      );
    }
    return true;
  });

  const playableEpisodes = episodes.filter(e => e.candidates.length > 0);
  const firstPlayable = playableEpisodes[0] || episodes[0];

  const openWatch = (epId: string) => {
    navigateTo(
      `/watch/${encodeURIComponent(item.provider)}/${encodeURIComponent(item.id)}?ep=${encodeURIComponent(epId)}&voice=${encodeURIComponent(selectedVoice)}`
    );
  };

  const maxRatingCount = Math.max(1, ...(detail.ratingStats || []).map(s => s.count));

  const facts: Array<{ label: string; value: string }> = [];
  if (detail.status) facts.push({ label: 'Status', value: detail.status });
  if (item.year) facts.push({ label: t('filters.year'), value: String(item.year) });
  if (detail.country || item.country) {
    facts.push({ label: t('detail.country'), value: String(detail.country || item.country) });
  }
  if (detail.studio || item.studio) {
    facts.push({ label: t('detail.studio'), value: String(detail.studio || item.studio) });
  }
  if (detail.director) facts.push({ label: t('detail.director'), value: detail.director });
  if (detail.runtimeMinutes) {
    facts.push({ label: t('detail.runtime'), value: `${detail.runtimeMinutes} min` });
  }
  if (detail.ageRating || item.ageRating) {
    facts.push({ label: t('detail.ageRating'), value: String(detail.ageRating || item.ageRating) });
  }
  if (episodes.length > 0) {
    facts.push({ label: t('detail.episodes'), value: String(episodes.length) });
  }

  return (
    <div class="shelf-section">
      <div>
        <Button variant="ghost" onClick={() => navigateBack('/')}>
          ← {t('detail.back')}
        </Button>
      </div>

      <section class="detail-hero">
        {(detail.backdropUrl || item.backdropUrl || item.posterUrl) && (
          <div
            class="hero-bg-layer"
            style={{
              backgroundImage: `url("${detail.backdropUrl || item.backdropUrl || item.posterUrl}")`,
            }}
          />
        )}

        <div class="media-card-art">
          <CachedImage src={item.posterUrl} alt={item.title} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {item.badges.map(b => (
              <span key={b} class="mono-badge">
                {b}
              </span>
            ))}
            {item.rating != null && (
              <span
                style={{
                  color: 'var(--color-status-rating)',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                }}
              >
                ★ {item.rating.toFixed(1)}
              </span>
            )}
            {detail.votesCount != null && detail.votesCount > 0 && (
              <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>
                ({t('detail.votes', { count: detail.votesCount })})
              </span>
            )}
            {item.year && <span style={{ color: 'var(--color-text-muted)' }}>{item.year}</span>}
          </div>

          <h1 style={{ margin: 0, fontSize: '30px', fontWeight: 800, lineHeight: 1.15 }}>
            {item.title}
          </h1>
          {item.originalTitle && item.originalTitle !== item.title && (
            <div style={{ color: 'var(--color-accent-soft)', fontSize: '14px' }}>
              {item.originalTitle}
            </div>
          )}

          {item.genres.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {item.genres.map(g => (
                <span key={g} class="mono-badge">
                  {g}
                </span>
              ))}
            </div>
          )}

          <p
            style={{
              margin: 0,
              color: 'var(--color-text-secondary)',
              maxWidth: '76ch',
              lineHeight: 1.6,
            }}
          >
            {detail.synopsis}
          </p>

          <div class="hero-actions">
            {firstPlayable && firstPlayable.candidates.length > 0 && (
              <Button
                variant="primary"
                onClick={() => openWatch(resume?.episodeId || firstPlayable.id)}
              >
                ▶{' '}
                {resume ? `${t('detail.resume')} ${formatTime(resume.position)}` : t('detail.play')}
              </Button>
            )}
            {detail.trailerYoutubeId && (
              <Button variant="glass" onClick={() => setTrailerOpen(true)}>
                🎞 {t('detail.trailer')}
              </Button>
            )}
            <Button variant="glass" onClick={() => toggleFavorite(item)}>
              {lib?.favorite ? `★ ${t('detail.favorited')}` : `☆ ${t('detail.favorite')}`}
            </Button>
          </div>

          <ChoiceTabs<WatchStatus>
            ariaLabel="Watchlist status"
            value={lib?.status || 'planned'}
            onChange={next => setWatchStatus(item, next)}
            options={[
              { value: 'watching', label: t('detail.status.watching') },
              { value: 'planned', label: t('detail.status.planned') },
              { value: 'completed', label: t('detail.status.completed') },
              { value: 'on_hold', label: t('detail.status.on_hold') },
              { value: 'dropped', label: t('detail.status.dropped') },
            ]}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span class="mono-badge">
              {t('detail.yourRating')}: {lib?.personalRating ? `★ ${lib.personalRating}/10` : '—'}
            </span>
            <div class="star-picker" role="group" aria-label={t('detail.yourRating')}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(score => (
                <button
                  key={score}
                  type="button"
                  class={`star-btn${lib?.personalRating === score ? ' active' : ''}`}
                  onClick={() => setPersonalRating(item, score)}
                >
                  {score}
                </button>
              ))}
              {lib?.personalRating && (
                <Button variant="ghost" onClick={() => setPersonalRating(item, undefined)}>
                  {t('detail.clearRating')}
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {(facts.length > 0 || (detail.ratingStats && detail.ratingStats.length > 0)) && (
        <section class="detail-meta-grid">
          <div class="panel" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h2 class="shelf-title">{t('detail.facts')}</h2>
            <div class="facts-grid">
              {facts.map(f => (
                <div key={f.label} class="fact-item">
                  <div class="fact-label">{f.label}</div>
                  <div class="fact-value">{f.value}</div>
                </div>
              ))}
            </div>
            {detail.cast && detail.cast.length > 0 && (
              <div>
                <div class="fact-label" style={{ marginBottom: '6px' }}>
                  {t('detail.cast')}
                </div>
                <div style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                  {detail.cast.join(' · ')}
                </div>
              </div>
            )}
          </div>

          {detail.ratingStats && detail.ratingStats.length > 0 && (
            <div class="panel" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div class="shelf-header">
                <h2 class="shelf-title">{t('detail.ratingDist')}</h2>
                {item.rating != null && (
                  <span style={{ color: 'var(--color-status-rating)', fontWeight: 800 }}>
                    ★ {item.rating.toFixed(2)}
                  </span>
                )}
              </div>
              <div class="rating-dist">
                {detail.ratingStats.map(row => {
                  const pct = Math.max(2, Math.round((row.count / maxRatingCount) * 100));
                  return (
                    <div key={row.score} class="rating-row">
                      <span>{row.score}</span>
                      <div class="rating-bar-track">
                        <div class="rating-bar-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <span style={{ textAlign: 'right', color: 'var(--color-text-muted)' }}>
                        {row.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {shots.length > 0 && (
        <section class="shelf-section">
          <div class="shelf-header">
            <h2 class="shelf-title">{t('detail.screenshots')}</h2>
            <span class="mono-badge">{shots.length}</span>
          </div>
          <div class="shots-row">
            {shots.map((url, idx) => (
              <button
                key={url}
                type="button"
                class="shot-thumb"
                onClick={() => setLightboxIdx(idx)}
              >
                <CachedImage src={url} alt={`${item.title} still ${idx + 1}`} />
              </button>
            ))}
          </div>
        </section>
      )}

      {detail.franchise && detail.franchise.length > 1 && (
        <section class="shelf-section">
          <div class="shelf-header">
            <h2 class="shelf-title">{t('detail.franchise')}</h2>
            <span class="mono-badge">{detail.franchise.length}</span>
          </div>
          <div class="franchise-row">
            {detail.franchise.map(fr => (
              <button
                key={`${fr.provider}:${fr.id}`}
                type="button"
                class={`franchise-card${fr.active ? ' active' : ''}`}
                onClick={() =>
                  navigateTo(
                    `/title/${encodeURIComponent(fr.provider)}/${encodeURIComponent(fr.id)}`
                  )
                }
              >
                <div class="franchise-poster">
                  <CachedImage src={fr.posterUrl} alt={fr.title} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div class="media-card-title" style={{ fontSize: '12.5px' }}>
                    {fr.title}
                  </div>
                  <div class="media-card-meta">
                    {[fr.kind, fr.year].filter(Boolean).join(' · ')}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      <section class="shelf-section">
        <div class="shelf-header" style={{ flexWrap: 'wrap' }}>
          <div class="shelf-title-group">
            <h2 class="shelf-title">
              {t('detail.episodes')} ({visibleEpisodes.length})
            </h2>
            {detail.voices.length > 0 && (
              <ChoiceTabs
                ariaLabel={t('detail.voices')}
                value={selectedVoice}
                onChange={setSelectedVoice}
                options={detail.voices.map(v => ({ value: v, label: v }))}
              />
            )}
          </div>

          {episodes.length > 8 && (
            <input
              type="search"
              class="input-field"
              style={{ maxWidth: '240px', padding: '7px 12px' }}
              placeholder={t('detail.searchEpisode')}
              value={epFilter}
              onInput={e => setEpFilter((e.target as HTMLInputElement).value)}
            />
          )}
        </div>

        {seasons.length > 1 && (
          <ChoiceTabs<string>
            ariaLabel="Seasons"
            value={String(selectedSeason)}
            onChange={v => setSelectedSeason(Number(v))}
            options={seasons.map(s => ({
              value: String(s),
              label: t('detail.season', { num: s }),
            }))}
          />
        )}

        {episodes.length === 0 ? (
          <EmptyState
            title={t('detail.noStreams')}
            action={
              <Button variant="primary" onClick={() => navigateTo('/sources')}>
                ⚡ {t('nav.sources')}
              </Button>
            }
          />
        ) : (
          <div class="episode-grid">
            {visibleEpisodes.map(ep => {
              const isCurrent = resume?.episodeId === ep.id;
              const watched = isEpisodeWatched(item.provider, item.id, ep.id);
              const playable = ep.candidates.length > 0;
              return (
                <div key={ep.id} class={`episode-card${isCurrent ? ' active' : ''}`}>
                  <div class="episode-thumb">
                    <CachedImage
                      src={ep.thumbnailUrl || item.backdropUrl || item.posterUrl}
                      alt={ep.title}
                    />
                    {watched && <span class="watched-chip">✓ {t('detail.watched')}</span>}
                    {ep.durationSeconds && (
                      <span class="card-chip-bl">{formatTime(ep.durationSeconds)}</span>
                    )}
                    {ep.skips.length > 0 && <span class="card-chip-tr">Skip OP/ED</span>}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: '10px',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div class="media-card-title">
                        {seasons.length > 1 ? `S${ep.season} · ` : ''}E{ep.number} — {ep.title}
                      </div>
                      <div class="media-card-meta">
                        {[
                          ep.airDate,
                          playable ? ep.candidates.map(c => c.quality).join(' / ') : 'Metadata',
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </div>
                    <Button
                      variant={isCurrent ? 'primary' : 'glass'}
                      disabled={!playable}
                      onClick={() => openWatch(ep.id)}
                    >
                      ▶ {isCurrent ? t('detail.resume') : t('detail.play')}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {detail.similar && detail.similar.length > 0 && (
        <section class="shelf-section">
          <div class="shelf-header">
            <h2 class="shelf-title">{t('detail.similar')}</h2>
          </div>
          <div class="shelf-row">
            {detail.similar.map(sim => (
              <MediaCard key={`${sim.provider}:${sim.id}`} item={sim} />
            ))}
          </div>
        </section>
      )}

      {lightboxIdx !== null && shots[lightboxIdx] && (
        <div class="lightbox-modal" onClick={() => setLightboxIdx(null)}>
          <img
            src={shots[lightboxIdx]}
            alt={`${item.title} still`}
            onClick={e => e.stopPropagation()}
          />
          <div style={{ display: 'flex', gap: '10px' }} onClick={e => e.stopPropagation()}>
            <Button
              variant="glass"
              onClick={() => setLightboxIdx((lightboxIdx - 1 + shots.length) % shots.length)}
            >
              ← Prev
            </Button>
            <span class="mono-badge" style={{ alignSelf: 'center' }}>
              {lightboxIdx + 1} / {shots.length}
            </span>
            <Button
              variant="glass"
              onClick={() => setLightboxIdx((lightboxIdx + 1) % shots.length)}
            >
              Next →
            </Button>
            <Button variant="primary" onClick={() => setLightboxIdx(null)}>
              ✕ {t('common.close')}
            </Button>
          </div>
        </div>
      )}

      {trailerOpen && detail.trailerYoutubeId && (
        <div class="lightbox-modal" onClick={() => setTrailerOpen(false)}>
          <iframe
            class="trailer-frame"
            src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(detail.trailerYoutubeId)}?autoplay=1`}
            title={`${item.title} Trailer`}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            onClick={e => e.stopPropagation()}
          />
          <Button variant="primary" onClick={() => setTrailerOpen(false)}>
            ✕ {t('common.close')}
          </Button>
        </div>
      )}
    </div>
  );
}
