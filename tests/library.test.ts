import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearContinueHistory,
  continueEntries,
  getContinueEntry,
  getLibraryEntry,
  getLibraryStats,
  isEpisodeWatched,
  libraryEntries,
  markEpisodeWatched,
  recordContinueProgress,
  setPersonalRating,
  setWatchStatus,
  toggleFavorite,
} from '~/lib/library';
import type { MediaItem } from '~/lib/types';

const sampleItem: MediaItem = {
  id: 'frieren',
  provider: 'aniliberty',
  category: 'anime',
  title: 'Frieren',
  year: 2024,
  rating: 9.1,
  genres: ['Fantasy'],
  badges: ['AniLiberty'],
  audioLanguages: ['RU'],
  externalIds: { aniliberty: 1 },
  streamReady: true,
  sources: [],
};

describe('local library & continue watching', () => {
  beforeEach(() => {
    localStorage.clear();
    libraryEntries.value = [];
    clearContinueHistory();
  });

  it('tracks watchlist status and independent favorites', () => {
    setWatchStatus(sampleItem, 'watching');
    toggleFavorite(sampleItem);
    const entry = getLibraryEntry('aniliberty', 'frieren');
    expect(entry?.status).toBe('watching');
    expect(entry?.favorite).toBe(true);

    toggleFavorite(sampleItem);
    expect(getLibraryEntry('aniliberty', 'frieren')?.favorite).toBe(false);
    expect(getLibraryEntry('aniliberty', 'frieren')?.status).toBe('watching');
  });

  it('records normalized resume points without duplicate keys', () => {
    recordContinueProgress({
      provider: 'aniliberty',
      id: 'frieren',
      category: 'anime',
      title: 'Frieren',
      episodeId: 'ep-1',
      episodeLabel: 'S1 · E1',
      voiceLabel: 'AniLibria',
      position: 120,
      duration: 1440,
    });
    recordContinueProgress({
      provider: 'aniliberty',
      id: 'frieren',
      category: 'anime',
      title: 'Frieren',
      episodeId: 'ep-2',
      episodeLabel: 'S1 · E2',
      voiceLabel: 'AniLibria',
      position: 340,
      duration: 1440,
    });
    expect(continueEntries.value).toHaveLength(1);
    expect(getContinueEntry('aniliberty', 'frieren')?.position).toBe(340);
  });

  it('tracks personal 1-10 ratings, watched episodes, and library statistics', () => {
    setPersonalRating(sampleItem, 9);
    markEpisodeWatched(sampleItem, 'ep-1');
    markEpisodeWatched(sampleItem, 'ep-2');

    expect(getLibraryEntry('aniliberty', 'frieren')?.personalRating).toBe(9);
    expect(isEpisodeWatched('aniliberty', 'frieren', 'ep-1')).toBe(true);
    expect(isEpisodeWatched('aniliberty', 'frieren', 'ep-3')).toBe(false);

    const stats = getLibraryStats();
    expect(stats.totalTitles).toBe(1);
    expect(stats.watchedEpisodesCount).toBe(2);
    expect(stats.averageRating).toBe(9);
    expect(stats.topGenres[0]?.name).toBe('Fantasy');
  });
});
