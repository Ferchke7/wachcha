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

export function setWatchStatus(item: MediaItem, status: WatchStatus | undefined) {
  const key = mediaKey(item.provider, item.id);
  const current = [...libraryEntries.value];
  const idx = current.findIndex(e => e.mediaKey === key);
  const existing = idx >= 0 ? current[idx] : undefined;

  if (!status && !existing?.favorite) {
    if (idx >= 0) current.splice(idx, 1);
  } else {
    const entry: LibraryEntry = {
      mediaKey: key,
      provider: item.provider,
      id: item.id,
      category: item.category,
      title: item.title,
      posterUrl: item.posterUrl,
      year: item.year,
      rating: item.rating,
      status,
      favorite: existing?.favorite ?? false,
      updatedAt: Date.now(),
    };
    if (idx >= 0) current[idx] = entry;
    else current.unshift(entry);
  }

  libraryEntries.value = current;
  writeJson(LIBRARY_KEY, current);
}

export function toggleFavorite(item: MediaItem) {
  const key = mediaKey(item.provider, item.id);
  const current = [...libraryEntries.value];
  const idx = current.findIndex(e => e.mediaKey === key);
  const existing = idx >= 0 ? current[idx] : undefined;
  const nextFav = !existing?.favorite;

  if (!nextFav && !existing?.status) {
    if (idx >= 0) current.splice(idx, 1);
  } else {
    const entry: LibraryEntry = {
      mediaKey: key,
      provider: item.provider,
      id: item.id,
      category: item.category,
      title: item.title,
      posterUrl: item.posterUrl,
      year: item.year,
      rating: item.rating,
      status: existing?.status,
      favorite: nextFav,
      updatedAt: Date.now(),
    };
    if (idx >= 0) current[idx] = entry;
    else current.unshift(entry);
  }

  libraryEntries.value = current;
  writeJson(LIBRARY_KEY, current);
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

export function getContinueEntry(provider: string, id: string): ContinueEntry | undefined {
  return continueEntries.value.find(e => e.mediaKey === mediaKey(provider, id));
}

export function clearContinueHistory() {
  continueEntries.value = [];
  writeJson(CONTINUE_KEY, []);
}
