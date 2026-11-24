import { signal } from '@preact/signals';
import type { ContinueEntry, LibraryEntry, MediaItem, WatchStatus } from './types';

const LIBRARY_KEY = 'wachcha:library-v1';
const CONTINUE_KEY = 'wachcha:continue-v1';
const MAX_CONTINUE = 100;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors.
  }
}

export function mediaKey(provider: string, id: string): string {
  return `${provider}:${id}`;
}

export const libraryEntries = signal<LibraryEntry[]>(readJson<LibraryEntry[]>(LIBRARY_KEY, []));
export const continueEntries = signal<ContinueEntry[]>(readJson<ContinueEntry[]>(CONTINUE_KEY, []));

export function getLibraryEntry(provider: string, id: string): LibraryEntry | undefined {
  const key = mediaKey(provider, id);
  return libraryEntries.value.find(e => e.mediaKey === key);
}

function upsertLibrary(
  item: MediaItem,
  updater: (existing: LibraryEntry | undefined) => Partial<LibraryEntry> | null
) {
  const key = mediaKey(item.provider, item.id);
  const current = [...libraryEntries.value];
  const idx = current.findIndex(e => e.mediaKey === key);
  const existing = idx >= 0 ? current[idx] : undefined;
  const patch = updater(existing);

  if (patch === null) {
    if (idx >= 0) current.splice(idx, 1);
  } else {
    const merged: LibraryEntry = {
      mediaKey: key,
      provider: item.provider,
      id: item.id,
      category: item.category,
      title: item.title,
      posterUrl: item.posterUrl || existing?.posterUrl,
      year: item.year ?? existing?.year,
      rating: item.rating ?? existing?.rating,
      genres: item.genres?.length ? item.genres : existing?.genres || [],
      status: existing?.status,
      favorite: existing?.favorite ?? false,
      personalRating: existing?.personalRating,
      watchedEpisodes: existing?.watchedEpisodes || [],
      ...patch,
      updatedAt: Date.now(),
    };
    const isEmpty =
      !merged.status &&
      !merged.favorite &&
      !merged.personalRating &&
      (!merged.watchedEpisodes || merged.watchedEpisodes.length === 0);
    if (isEmpty) {
      if (idx >= 0) current.splice(idx, 1);
    } else if (idx >= 0) {
      current[idx] = merged;
    } else {
      current.unshift(merged);
    }
  }

  libraryEntries.value = current;
  writeJson(LIBRARY_KEY, current);
}

export function setWatchStatus(item: MediaItem, status: WatchStatus | undefined) {
  upsertLibrary(item, () => ({ status }));
}

export function toggleFavorite(item: MediaItem) {
  upsertLibrary(item, existing => ({ favorite: !existing?.favorite }));
}

export function setPersonalRating(item: MediaItem, score: number | undefined) {
  const clean = score != null && score >= 1 && score <= 10 ? Math.round(score) : undefined;
  upsertLibrary(item, () => ({ personalRating: clean }));
}

export function markEpisodeWatched(item: MediaItem, episodeId: string) {
  upsertLibrary(item, existing => {
    const prev = existing?.watchedEpisodes || [];
    if (prev.includes(episodeId)) return {};
    return {
      status: existing?.status || 'watching',
      watchedEpisodes: [...prev, episodeId].slice(-500),
    };
  });
}

export function isEpisodeWatched(provider: string, id: string, episodeId: string): boolean {
  const entry = getLibraryEntry(provider, id);
  return Boolean(entry?.watchedEpisodes?.includes(episodeId));
}

/**
 * Records normalized resume progress (zero stream tokens or signed CDN URLs persisted).
 */
export function recordContinueProgress(entry: Omit<ContinueEntry, 'mediaKey' | 'updatedAt'>) {
  const key = mediaKey(entry.provider, entry.id);
  const next: ContinueEntry = {
    ...entry,
    mediaKey: key,
    updatedAt: Date.now(),
  };
  const filtered = continueEntries.value.filter(e => e.mediaKey !== key);
  const merged = [next, ...filtered].slice(0, MAX_CONTINUE);
  continueEntries.value = merged;
  writeJson(CONTINUE_KEY, merged);
}

export function removeContinueEntry(provider: string, id: string) {
  const key = mediaKey(provider, id);
  const filtered = continueEntries.value.filter(e => e.mediaKey !== key);
  continueEntries.value = filtered;
  writeJson(CONTINUE_KEY, filtered);
}

export function getContinueEntry(provider: string, id: string): ContinueEntry | undefined {
  return continueEntries.value.find(e => e.mediaKey === mediaKey(provider, id));
}

export function clearContinueHistory() {
  continueEntries.value = [];
  writeJson(CONTINUE_KEY, []);
}

export interface LibraryStats {
  totalTitles: number;
  favoritesCount: number;
  watchedEpisodesCount: number;
  estimatedHours: number;
  ratedCount: number;
  averageRating: number | null;
  byStatus: Record<WatchStatus, number>;
  topGenres: Array<{ name: string; count: number }>;
}

export function getLibraryStats(): LibraryStats {
  const list = libraryEntries.value;
  const byStatus: Record<WatchStatus, number> = {
    watching: 0,
    planned: 0,
    completed: 0,
    on_hold: 0,
    dropped: 0,
  };
  let watchedEpisodesCount = 0;
  let ratingSum = 0;
  let ratedCount = 0;
  let favoritesCount = 0;
  const genreCounts = new Map<string, number>();

  for (const e of list) {
    if (e.status) byStatus[e.status] += 1;
    if (e.favorite) favoritesCount += 1;
    if (e.personalRating) {
      ratingSum += e.personalRating;
      ratedCount += 1;
    }
    const eps = e.watchedEpisodes?.length || (e.status === 'completed' ? 1 : 0);
    watchedEpisodesCount += eps;
    for (const g of e.genres || []) {
      genreCounts.set(g, (genreCounts.get(g) || 0) + 1);
    }
  }

  const topGenres = [...genreCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count]) => ({ name, count }));

  return {
    totalTitles: list.length,
    favoritesCount,
    watchedEpisodesCount,
    estimatedHours: Math.round((watchedEpisodesCount * 24) / 60),
    ratedCount,
    averageRating: ratedCount > 0 ? Number((ratingSum / ratedCount).toFixed(1)) : null,
    byStatus,
    topGenres,
  };
}
