export type MediaCategory = 'movie' | 'series' | 'turkish-dizi' | 'anime' | 'live-tv';
export type TopsVertical =
  'anime' | 'shikimori' | 'ongoing' | 'movie' | 'series' | 'turkish-dizi' | 'russian' | 'live-tv';
export type SortMode = 'rating' | 'popular' | 'newest' | 'year';
export type Locale = 'en' | 'ru' | 'tr';
export type WatchStatus = 'watching' | 'planned' | 'completed' | 'on_hold' | 'dropped';
export type PlaybackEngine = 'auto' | 'shaka' | 'libmpv';
export type ShaderPreset = 'off' | 'anime4k-fast' | 'fsr' | 'fsrcnnx';

export interface ExternalIds {
  imdb?: string;
  tmdb?: number;
  kinopoisk?: number;
  shikimori?: number;
  mal?: number;
  aniliberty?: number;
  tvmaze?: number;
  rutube?: string;
}

export interface SourceLink {
  provider: string;
  id: string;
  label: string;
}

export interface MediaItem {
  id: string;
  provider: string;
  category: MediaCategory;
  title: string;
  originalTitle?: string;
  year?: number;
  rating?: number;
  rank?: number;
  episodesCount?: number;
  status?: string;
  ageRating?: string;
  country?: string;
  studio?: string;
  synopsis?: string;
  airingInfo?: string;
  posterUrl?: string;
  backdropUrl?: string;
  genres: string[];
  badges: string[];
  audioLanguages: string[];
  externalIds: ExternalIds;
  streamReady: boolean;
  sources: SourceLink[];
}

export interface SkipInterval {
  kind: 'opening' | 'ending' | 'recap';
  from: number;
  to: number;
}

export interface SubtitleTrack {
  lang: string;
  label: string;
  url: string;
  format: string;
}

export interface StreamCandidate {
  provider: string;
  mediaId: string;
  episodeId: string;
  voiceLabel: string;
  quality: string;
  format: 'hls' | 'dash' | 'mp4' | string;
  url: string;
  preferred?: boolean;
  headers?: [string, string][];
  allowedHosts?: string[];
  skips?: SkipInterval[];
  subtitles?: SubtitleTrack[];
}

export interface Episode {
  id: string;
  season: number;
  number: number;
  title: string;
  durationSeconds?: number;
  thumbnailUrl?: string;
  airDate?: string;
  synopsis?: string;
  skips: SkipInterval[];
  candidates: StreamCandidate[];
}

export interface RatingStat {
  score: number;
  count: number;
}

export interface FranchiseEntry {
  id: string;
  provider: string;
  title: string;
  year?: number;
  kind?: string;
  posterUrl?: string;
  active?: boolean;
}

export interface MediaDetail {
  item: MediaItem;
  synopsis: string;
  status?: string;
  voices: string[];
  episodes: Episode[];
  backdropUrl?: string;
  screenshots?: string[];
  ratingStats?: RatingStat[];
  votesCount?: number;
  trailerYoutubeId?: string;
  cast?: string[];
  director?: string;
  country?: string;
  studio?: string;
  ageRating?: string;
  runtimeMinutes?: number;
  franchise?: FranchiseEntry[];
  similar?: MediaItem[];
}

export interface CatalogShelf {
  id: string;
  titleKey: string;
  providerBadge: string;
  category: MediaCategory;
  items: MediaItem[];
}

export interface GenreOption {
  id: string;
  name: string;
}

export interface PagedResult {
  items: MediaItem[];
  page: number;
  total: number;
  hasMore: boolean;
}

export interface WeeklySchedule {
  days: MediaItem[][];
}

export interface SearchQuery {
  text: string;
  category?: MediaCategory;
  locale?: Locale;
  provider?: string;
}

export interface SearchResponse {
  query: string;
  items: MediaItem[];
  providerErrors: string[];
}

export interface ResolvedStream {
  provider: string;
  quality: string;
  format: 'hls' | 'dash' | 'mp4' | string;
  url: string;
  relayed: boolean;
  sourceHost: string;
  voiceLabel: string;
  skips: SkipInterval[];
  subtitles: SubtitleTrack[];
}

export interface StreamResolution {
  provider: string;
  episodeId: string;
  streams: ResolvedStream[];
}

export interface ProviderInfo {
  id: string;
  name: string;
  description: string;
  categories: MediaCategory[];
  enabled: boolean;
  requiresKey: boolean;
  keyConfigured: boolean;
  keyless: boolean;
  streamCapable: boolean;
  kind: 'native' | 'stremio' | 'm3u' | string;
}

export interface ProviderHealth {
  provider: string;
  activeMirror: string;
  healthy: boolean;
  latencyMs?: number;
  detail: string;
}

export interface DesktopInfo {
  platform: string;
  version: string;
  nativeVideo: {
    available: boolean;
    libraryPath?: string;
    shaders: ShaderPreset[];
  };
}

export interface ContinueEntry {
  mediaKey: string;
  provider: string;
  id: string;
  category: MediaCategory;
  title: string;
  posterUrl?: string;
  episodeId: string;
  episodeLabel: string;
  voiceLabel: string;
  position: number;
  duration: number;
  updatedAt: number;
}

export interface LibraryEntry {
  mediaKey: string;
  provider: string;
  id: string;
  category: MediaCategory;
  title: string;
  posterUrl?: string;
  year?: number;
  rating?: number;
  genres?: string[];
  status?: WatchStatus;
  favorite: boolean;
  personalRating?: number;
  watchedEpisodes?: string[];
  updatedAt: number;
}

export interface PlaybackEvent {
  version: 1;
  reason:
    | 'sourcechange'
    | 'playing'
    | 'pause'
    | 'timeupdate'
    | 'seeking'
    | 'seeked'
    | 'buffering'
    | 'ended'
    | 'skip'
    | 'dispose'
    | 'saved'
    | 'saveerror';
  timestamp: number;
  playback: {
    mediaId: string;
    provider: string;
    episodeId: string;
    voice: string;
    sourceHost: string;
    quality: string;
    format: string;
    relayed: boolean;
    engine: 'shaka' | 'native-video' | 'libmpv';
    position: number;
    duration: number;
    watchedSeconds: number;
    playing: boolean;
  };
  skip?: {
    kind: SkipInterval['kind'];
    from: number;
    to: number;
    automatic: boolean;
  };
}
