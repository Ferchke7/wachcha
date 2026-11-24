/**
 * Wachcha Web API & Media Gateway Server.
 * - Serves the built Preact SPA (`dist/`) for self-hosted deployments (e.g. wachcha.codeguru.ovh).
 * - Aggregates live keyless multi-vertical catalogs (AniLiberty, Shikimori, Cinemeta, TVMaze,
 *   Rutube Public, Turkish Diziler, and Free-to-Air Live TV) with bounded LRU TTL caching.
 * - Provides strictly allowlisted, SSRF-hardened `/api/hls` and `/api/img` transport relays.
 */

import { readFile, stat } from 'node:fs/promises';
import http from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';
const DIST_DIR = resolve(process.env.DIST_DIR || 'dist');
const USER_AGENT = 'Wachcha/0.2 (+https://github.com/Ferchke7/wachcha)';
const MAX_CACHE_ENTRIES = 512;
const MAX_PLAYLIST_BYTES = 512 * 1024;
const MAX_SEGMENT_BYTES = 24 * 1024 * 1024;
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.woff2': 'font/woff2',
};

const ALLOWED_IMAGE_SUFFIXES = [
  'aniliberty.top',
  'anilibria.tv',
  'libria.fun',
  'shikimori.io',
  'shikimori.one',
  'images.metahub.space',
  'static.tvmaze.com',
  'pic.rtbcdn.ru',
  'image.tmdb.org',
  'm.media-amazon.com',
  'upload.wikimedia.org',
];

const ALLOWED_MEDIA_SUFFIXES = [
  'libria.fun',
  'aniliberty.top',
  'anilibria.tv',
  'rutube.ru',
  'rtbcdn.ru',
  'rutubelist.ru',
  'akamaized.net',
  'akamaistream.net',
  'cloudfront.net',
  'fastly.net',
  'llnwd.net',
  'mediatriple.net',
  'daioncdn.net',
  'ercdn.net',
  'nhk.jp',
  'dw.com',
  'france24.com',
  'euronews.com',
  'redbull.com',
];

const CURATED_TURKISH_TVMAZE_IDS = [
  { id: 44935, network: 'ATV', ruTitle: 'Основание: Осман', imdb: 'tt11093750' },
  { id: 64593, network: 'Show TV', ruTitle: 'Клюквенный щербет', imdb: 'tt22297608' },
  { id: 57473, network: 'Kanal D', ruTitle: 'Приговор', imdb: 'tt15175452' },
  { id: 53847, network: 'TRT 1', ruTitle: 'Разведка', imdb: 'tt13711618' },
  { id: 64071, network: 'Star TV', ruTitle: 'Зимородок', imdb: 'tt21431986' },
  { id: 11834, network: 'TRT 1', ruTitle: 'Воскресший Эртугрул', imdb: 'tt4320258' },
  { id: 48595, network: 'NOW', ruTitle: 'Постучись в мою дверь', imdb: 'tt12439466' },
  { id: 32417, network: 'Show TV', ruTitle: 'Чукур', imdb: 'tt7431994' },
  { id: 8448, network: 'ATV', ruTitle: 'Эзель', imdb: 'tt1534360' },
  { id: 5858, network: 'Star TV', ruTitle: 'Великолепный век', imdb: 'tt1848620' },
  { id: 7580, network: 'Star TV', ruTitle: 'Чёрная любовь', imdb: 'tt5133970' },
  { id: 80669, network: 'Kanal D', ruTitle: 'Далёкий город', imdb: 'tt33080168' },
  { id: 74223, network: 'Show TV', ruTitle: 'Бахар', imdb: 'tt30830106' },
  { id: 18892, network: 'Kanal D', ruTitle: 'Запретная любовь', imdb: 'tt1298820' },
  { id: 37065, network: 'Star TV', ruTitle: 'Ранняя пташка', imdb: 'tt8473302' },
  { id: 7664, network: 'Star TV', ruTitle: 'Любовь напрокат', imdb: 'tt4787028' },
];

const CURATED_LIVE_CHANNELS = [
  {
    id: 'trt-world',
    title: 'TRT World HD',
    originalTitle: 'TRT World Live',
    country: 'Turkey',
    lang: 'EN',
    genres: ['News', 'Live'],
    poster:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/TRT_World_logo.svg/512px-TRT_World_logo.svg.png',
    url: 'https://tv-trtworld.medya.trt.com.tr/master.m3u8',
  },
  {
    id: 'trt-1',
    title: 'TRT 1 HD (Turkey)',
    originalTitle: 'TRT 1 Canlı',
    country: 'Turkey',
    lang: 'TR',
    genres: ['Drama', 'Dizi', 'Live'],
    poster:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/TRT_1_logo_%282021-%29.svg/512px-TRT_1_logo_%282021-%29.svg.png',
    url: 'https://tv-trt1.medya.trt.com.tr/master.m3u8',
  },
  {
    id: 'trt-haber',
    title: 'TRT Haber HD',
    originalTitle: 'TRT Haber Canlı',
    country: 'Turkey',
    lang: 'TR',
    genres: ['News', 'Live'],
    poster:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/TRT_Haber_logo_%282020%29.svg/512px-TRT_Haber_logo_%282020%29.svg.png',
    url: 'https://tv-trthaber.medya.trt.com.tr/master.m3u8',
  },
  {
    id: 'trt-belgesel',
    title: 'TRT Belgesel HD',
    originalTitle: 'TRT Documentary',
    country: 'Turkey',
    lang: 'TR',
    genres: ['Documentary', 'Live'],
    poster:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/TRT_Belgesel_logo_%282019%29.svg/512px-TRT_Belgesel_logo_%282019%29.svg.png',
    url: 'https://tv-trtbelgesel.medya.trt.com.tr/master.m3u8',
  },
  {
    id: 'dw-english',
    title: 'DW English HD',
    originalTitle: 'Deutsche Welle',
    country: 'Germany',
    lang: 'EN',
    genres: ['News', 'Documentary', 'Live'],
    poster:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Deutsche_Welle_symbol_2012.svg/512px-Deutsche_Welle_symbol_2012.svg.png',
    url: 'https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8',
  },
  {
    id: 'nhk-world',
    title: 'NHK World Japan HD',
    originalTitle: 'NHK World',
    country: 'Japan',
    lang: 'EN',
    genres: ['Culture', 'Anime', 'News', 'Live'],
    poster:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/NHK_World.svg/512px-NHK_World.svg.png',
    url: 'https://nhkwlive-ojp.akamaized.net/hls/live/2003459/nhkwlive-ojp-en/index.m3u8',
  },
  {
    id: 'redbull-tv',
    title: 'Red Bull TV HD',
    originalTitle: 'Red Bull TV Global',
    country: 'Global',
    lang: 'EN',
    genres: ['Sports', 'Action', 'Live'],
    poster:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Red_Bull_TV_logo.svg/512px-Red_Bull_TV_logo.svg.png',
    url: 'https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8',
  },
];

ALLOWED_MEDIA_SUFFIXES.push('medya.trt.com.tr');

const ALLOWED_SUBTITLE_SUFFIXES = ['strem.io', 'opensubtitles.org', 'opensubtitles.com'];

function srtToVtt(text) {
  const trimmed = String(text || '')
    .replace(/^\uFEFF/, '')
    .trim();
  if (trimmed.startsWith('WEBVTT')) return trimmed;
  return (
    'WEBVTT\n\n' + trimmed.replace(/\r\n/g, '\n').replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
  );
}

async function fetchOpenSubtitles(mediaType, imdbId, season, episode) {
  if (!imdbId || !/^tt\d+$/.test(imdbId)) return [];
  const subId =
    mediaType === 'series' && season && episode ? `${imdbId}:${season}:${episode}` : imdbId;
  const key = `osub:${mediaType}:${subId}`;
  return cached(key, 30 * 60_000, async () => {
    try {
      const json = await fetchJson(
        `https://opensubtitles-v3.strem.io/subtitles/${mediaType === 'series' ? 'series' : 'movie'}/${encodeURIComponent(subId)}.json`,
        { timeoutMs: 5500 }
      );
      const list = Array.isArray(json?.subtitles) ? json.subtitles : [];
      const wanted = [
        { code: 'rus', lang: 'ru', label: 'Русский (OpenSubtitles)' },
        { code: 'tur', lang: 'tr', label: 'Türkçe (OpenSubtitles)' },
        { code: 'eng', lang: 'en', label: 'English (OpenSubtitles)' },
      ];
      const tracks = [];
      for (const w of wanted) {
        const hit = list.find(
          s => String(s?.lang || '').toLowerCase() === w.code && typeof s?.url === 'string'
        );
        if (hit && isHostAllowed(hit.url, ALLOWED_SUBTITLE_SUFFIXES)) {
          tracks.push({
            lang: w.lang,
            label: w.label,
            url: `/api/sub?url=${encodeURIComponent(hit.url)}`,
            format: 'vtt',
          });
        }
      }
      return tracks;
    } catch {
      return [];
    }
  });
}

/** Bounded in-memory TTL LRU cache */
const cache = new Map();
const inflight = new Map();

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  // Touch LRU order
  cache.delete(key);
  cache.set(key, hit);
  return hit.value;
}

function cacheSet(key, value, ttlMs) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

async function cached(key, ttlMs, loader) {
  const hit = cacheGet(key);
  if (hit !== undefined) return hit;
  const pending = inflight.get(key);
  if (pending) return pending;
  const p = Promise.resolve()
    .then(loader)
    .then(val => {
      if (val !== undefined) cacheSet(key, val, ttlMs);
      return val;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export function isHostAllowed(rawUrl, allowedSuffixes) {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== 'https:') return false;
    const host = u.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host.endsWith('.local') ||
      /^\d+\.\d+\.\d+\.\d+$/.test(host) ||
      host.includes(':')
    ) {
      return false;
    }
    return allowedSuffixes.some(sfx => host === sfx || host.endsWith(`.${sfx}`));
  } catch {
    return false;
  }
}

function proxyImg(url) {
  if (!url) return undefined;
  const clean = url.startsWith('//') ? `https:${url}` : url.replace(/^http:\/\//, 'https://');
  if (!isHostAllowed(clean, ALLOWED_IMAGE_SUFFIXES)) return clean;
  return `/api/img?url=${encodeURIComponent(clean)}`;
}

function proxyHls(url) {
  if (!url) return url;
  return `/api/hls?url=${encodeURIComponent(url)}`;
}

async function fetchJson(url, { timeoutMs = 9000, headers = {} } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
        ...headers,
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\[[^\]]+\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function absUrl(base, maybePath) {
  if (!maybePath) return undefined;
  if (maybePath.startsWith('http://') || maybePath.startsWith('https://')) return maybePath;
  if (maybePath.startsWith('//')) return `https:${maybePath}`;
  return `${base}${maybePath.startsWith('/') ? '' : '/'}${maybePath}`;
}

function mapAniLibertyItem(r, rank) {
  const posterRaw = r?.poster?.optimized?.src || r?.poster?.src || r?.poster?.optimized?.preview;
  const posterUrl = proxyImg(absUrl('https://aniliberty.top', posterRaw));
  const alias = r?.alias || String(r?.id || '');
  const genres = Array.isArray(r?.genres)
    ? r.genres.map(g => (typeof g === 'string' ? g : g?.name)).filter(Boolean)
    : [];
  const favs = Number(r?.added_in_users_favorites || 0);
  const rawRating = typeof r?.rating === 'number' && r.rating > 0 ? r.rating : undefined;
  const derivedScore =
    rawRating ??
    (favs > 0 ? Math.min(9.6, Number((7.2 + Math.log10(favs + 10) * 0.48).toFixed(1))) : undefined);

  return {
    id: alias,
    provider: 'aniliberty',
    category: 'anime',
    title: r?.name?.main || r?.name?.english || alias,
    originalTitle: r?.name?.english || undefined,
    year: typeof r?.year === 'number' ? r.year : undefined,
    rating: derivedScore,
    rank,
    episodesCount: typeof r?.episodes_total === 'number' ? r.episodes_total : undefined,
    status: r?.is_ongoing ? 'Ongoing' : 'Completed',
    ageRating: r?.age_rating?.label || undefined,
    synopsis: stripHtml(r?.description || '').slice(0, 320) || undefined,
    posterUrl,
    backdropUrl: posterUrl,
    genres,
    badges: [r?.is_ongoing ? 'Ongoing' : 'AniLiberty', '1080p HLS', 'RU Dub'],
    audioLanguages: ['RU'],
    externalIds: {
      aniliberty: typeof r?.id === 'number' ? r.id : undefined,
      shikimori: typeof r?.shikimori === 'number' ? r.shikimori : undefined,
      mal: typeof r?.mal === 'number' ? r.mal : undefined,
    },
    streamReady: true,
    sources: [{ provider: 'aniliberty', id: alias, label: 'AniLiberty HLS' }],
  };
}

function mapShikimoriItem(r, rank) {
  const img = r?.image?.original || r?.image?.preview;
  const posterUrl = proxyImg(absUrl('https://shikimori.io', img));
  const score = Number.parseFloat(String(r?.score || '0'));
  return {
    id: String(r?.id || ''),
    provider: 'shikimori',
    category: 'anime',
    title: r?.russian || r?.name || 'Anime',
    originalTitle: r?.name || undefined,
    year: typeof r?.aired_on === 'string' ? Number(r.aired_on.slice(0, 4)) || undefined : undefined,
    rating: Number.isFinite(score) && score > 0 ? score : undefined,
    rank,
    episodesCount: typeof r?.episodes === 'number' && r.episodes > 0 ? r.episodes : undefined,
    status: r?.status || undefined,
    posterUrl,
    backdropUrl: posterUrl,
    genres: Array.isArray(r?.genres)
      ? r.genres.map(g => g?.russian || g?.name).filter(Boolean)
      : [],
    badges: ['Shikimori', r?.kind ? String(r.kind).toUpperCase() : 'ANIME'],
    audioLanguages: ['RU', 'JP'],
    externalIds: {
      shikimori: Number(r?.id) || undefined,
      mal: Number(r?.id) || undefined,
    },
    streamReady: true,
    sources: [{ provider: 'shikimori', id: String(r?.id || ''), label: 'Shikimori + AniLiberty' }],
  };
}

function mapCinemetaItem(m, category, rank) {
  const imdbId = m?.imdb_id || m?.id;
  const type = m?.type === 'series' ? 'series' : 'movie';
  const score = Number.parseFloat(String(m?.imdbRating || '0'));
  const yearMatch = String(m?.releaseInfo || m?.year || '').match(/\d{4}/);
  const posterUrl = proxyImg(m?.poster);
  const backdropUrl = proxyImg(m?.background || m?.poster);
  return {
    id: `${type}:${imdbId}`,
    provider: 'cinemeta',
    category,
    title: m?.name || imdbId,
    originalTitle: m?.name || undefined,
    year: yearMatch ? Number(yearMatch[0]) : undefined,
    rating: Number.isFinite(score) && score > 0 ? score : undefined,
    rank,
    synopsis: stripHtml(m?.description || '').slice(0, 320) || undefined,
    country: m?.country || undefined,
    posterUrl,
    backdropUrl,
    genres: Array.isArray(m?.genres) ? m.genres.map(String) : [],
    badges: ['IMDb', type === 'movie' ? 'Movie' : 'Series'],
    audioLanguages: ['EN', 'RU'],
    externalIds: { imdb: imdbId },
    streamReady: true,
    sources: [{ provider: 'cinemeta', id: `${type}:${imdbId}`, label: 'IMDb + Rutube / Addons' }],
  };
}

function mapRutubeItem(v, category = 'movie', rank) {
  const durMin = Math.round(Number(v?.duration || 0) / 60);
  const posterUrl = proxyImg(v?.thumbnail_url);
  return {
    id: String(v?.id || ''),
    provider: 'rutube',
    category,
    title: v?.title || 'Rutube Video',
    year:
      typeof v?.created_ts === 'string' ? Number(v.created_ts.slice(0, 4)) || undefined : undefined,
    rating: undefined,
    rank,
    synopsis: stripHtml(v?.description || '').slice(0, 260) || undefined,
    posterUrl,
    backdropUrl: posterUrl,
    genres: [
      v?.category?.name || (category === 'turkish-dizi' ? 'Turkish Dizi' : 'Russian Cinema'),
    ].filter(Boolean),
    badges: ['Rutube HD', durMin > 0 ? `${durMin} min` : 'HLS', 'RU'],
    audioLanguages: ['RU'],
    externalIds: { rutube: String(v?.id || '') },
    streamReady: true,
    sources: [{ provider: 'rutube', id: String(v?.id || ''), label: 'Rutube HLS' }],
  };
}

function mapTvMazeShow(show, extra = {}, rank) {
  const lang = String(show?.language || '').toLowerCase();
  const isTr = lang === 'turkish' || Boolean(extra.forceTurkish);
  const posterUrl = proxyImg(show?.image?.original || show?.image?.medium);
  const rating = typeof show?.rating?.average === 'number' ? show.rating.average : undefined;
  const network = show?.network?.name || show?.webChannel?.name || extra.network;
  return {
    id: String(show?.id || ''),
    provider: 'tvmaze',
    category: isTr ? 'turkish-dizi' : 'series',
    title: extra.ruTitle ? `${show?.name} (${extra.ruTitle})` : show?.name || 'TV Show',
    originalTitle: show?.name || undefined,
    year:
      typeof show?.premiered === 'string'
        ? Number(show.premiered.slice(0, 4)) || undefined
        : undefined,
    rating,
    rank,
    status: show?.status || undefined,
    country: show?.network?.country?.name || (isTr ? 'Turkey' : undefined),
    synopsis: stripHtml(show?.summary || '').slice(0, 320) || undefined,
    posterUrl,
    backdropUrl: posterUrl,
    genres: Array.isArray(show?.genres) ? show.genres.map(String) : [],
    badges: [network || 'TVMaze', isTr ? 'Dizi' : 'Series', 'RU/TR'],
    audioLanguages: isTr ? ['TR', 'RU'] : ['EN'],
    externalIds: {
      tvmaze: Number(show?.id) || undefined,
      imdb: show?.externals?.imdb || extra.imdb || undefined,
    },
    streamReady: true,
    sources: [
      { provider: 'tvmaze', id: String(show?.id || ''), label: network || 'TVMaze + Rutube' },
    ],
  };
}

function mapLiveChannel(ch, rank) {
  return {
    id: ch.id,
    provider: 'livetv',
    category: 'live-tv',
    title: ch.title,
    originalTitle: ch.originalTitle,
    country: ch.country,
    rank,
    posterUrl: proxyImg(ch.poster),
    backdropUrl: proxyImg(ch.poster),
    genres: ch.genres,
    badges: ['LIVE', ch.lang, ch.country],
    audioLanguages: [ch.lang],
    externalIds: {},
    streamReady: true,
    sources: [{ provider: 'livetv', id: ch.id, label: 'Official HLS Live' }],
  };
}

// ---------------------------------------------------------------------------
// Live Data Loaders (cached)
// ---------------------------------------------------------------------------

async function loadAniLibertyTop({
  page = 1,
  limit = 24,
  sort = 'RATING_DESC',
  genre,
  year,
  ongoingOnly = false,
} = {}) {
  const key = `al:cat:${page}:${limit}:${sort}:${genre || ''}:${year || ''}:${ongoingOnly}`;
  return cached(key, 5 * 60_000, async () => {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    params.set('page', String(page));
    params.set('f[sorting]', sort);
    if (ongoingOnly) params.set('f[publish_statuses]', 'IS_ONGOING');
    if (year) {
      params.set('f[years][from_year]', String(year));
      params.set('f[years][to_year]', String(year));
    }
    if (genre && /^\d+$/.test(String(genre))) {
      params.set('f[genres]', String(genre));
    }
    const json = await fetchJson(
      `https://aniliberty.top/api/v1/anime/catalog/releases?${params.toString()}`
    );
    const rows = Array.isArray(json?.data) ? json.data : [];
    const offset = (page - 1) * limit;
    const pagination = json?.meta?.pagination || {};
    return {
      items: rows.map((r, i) => mapAniLibertyItem(r, offset + i + 1)),
      page,
      total: Number(pagination.total || rows.length),
      hasMore: Number(pagination.current_page || page) < Number(pagination.total_pages || 1),
    };
  });
}

async function loadAniLibertyLatest(limit = 20) {
  return cached(`al:latest:${limit}`, 3 * 60_000, async () => {
    const rows = await fetchJson(
      `https://aniliberty.top/api/v1/anime/releases/latest?limit=${limit}`
    );
    return (Array.isArray(rows) ? rows : []).map(r => mapAniLibertyItem(r));
  });
}

async function loadAniLibertyGenres() {
  return cached('al:genres', 60 * 60_000, async () => {
    const rows = await fetchJson('https://aniliberty.top/api/v1/anime/catalog/references/genres');
    return (Array.isArray(rows) ? rows : []).map(g => ({ id: String(g.id), name: String(g.name) }));
  });
}

async function loadShikimoriTop({ page = 1, limit = 24, order = 'ranked' } = {}) {
  return cached(`shiki:top:${order}:${page}:${limit}`, 10 * 60_000, async () => {
    const rows = await fetchJson(
      `https://shikimori.io/api/animes?order=${encodeURIComponent(order)}&limit=${limit}&page=${page}`
    );
    const offset = (page - 1) * limit;
    const list = Array.isArray(rows) ? rows : [];
    return {
      items: list.map((r, i) => mapShikimoriItem(r, offset + i + 1)),
      page,
      total: 1000,
      hasMore: list.length >= limit,
    };
  });
}

async function loadCinemetaCatalog(type, catalogId, { page = 1, limit = 24, genre } = {}) {
  const skip = (page - 1) * limit;
  const genrePart = genre ? `/genre=${encodeURIComponent(genre)}` : '';
  const skipPart = skip > 0 ? `${genrePart ? '&' : '/'}skip=${skip}` : '';
  const suffix = genrePart || skipPart ? `${genrePart}${skipPart}` : '';
  const url = `https://v3-cinemeta.strem.io/catalog/${type}/${catalogId}${suffix}.json`;
  return cached(
    `cm:${type}:${catalogId}:${genre || ''}:${page}:${limit}`,
    10 * 60_000,
    async () => {
      const json = await fetchJson(url);
      const metas = Array.isArray(json?.metas) ? json.metas : [];
      const slice = metas.slice(0, limit);
      return {
        items: slice.map((m, i) =>
          mapCinemetaItem(m, type === 'movie' ? 'movie' : 'series', skip + i + 1)
        ),
        page,
        total: metas.length + skip,
        hasMore: metas.length >= limit,
      };
    }
  );
}

async function loadRutubeCatalog(query, category = 'movie', page = 1) {
  return cached(`rt:cat:${query}:${category}:${page}`, 10 * 60_000, async () => {
    const json = await fetchJson(
      `https://rutube.ru/api/search/video/?query=${encodeURIComponent(query)}&page=${page}`,
      { timeoutMs: 7000 }
    );
    const raw = Array.isArray(json?.results) ? json.results : [];
    const longVideos = raw.filter(v => Number(v?.duration || 0) >= 1200 && v?.thumbnail_url);
    const picked = longVideos.length >= 6 ? longVideos : raw.filter(v => v?.thumbnail_url);
    const offset = (page - 1) * 20;
    return {
      items: picked.slice(0, 24).map((v, i) => mapRutubeItem(v, category, offset + i + 1)),
      page,
      total: Number(json?.count || picked.length),
      hasMore: Boolean(json?.has_next),
    };
  });
}

async function loadTurkishDizis() {
  return cached('tr:dizis:v1', 30 * 60_000, async () => {
    const settled = await Promise.allSettled(
      CURATED_TURKISH_TVMAZE_IDS.map(async (meta, idx) => {
        const show = await fetchJson(`https://api.tvmaze.com/shows/${meta.id}`, {
          timeoutMs: 7000,
        });
        return mapTvMazeShow(show, { ...meta, forceTurkish: true }, idx + 1);
      })
    );
    const items = settled
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value)
      .sort((a, b) => (b.rating || 7.0) - (a.rating || 7.0))
      .map((item, idx) => ({ ...item, rank: idx + 1 }));
    return items;
  });
}

async function loadWeeklySchedule() {
  return cached('schedule:week', 15 * 60_000, async () => {
    const days = [[], [], [], [], [], [], []]; // 0 = Mon .. 6 = Sun
    try {
      const rows = await fetchJson('https://aniliberty.top/api/v1/anime/schedule/week');
      if (Array.isArray(rows)) {
        for (const entry of rows) {
          const rel = entry?.release || entry;
          if (!rel?.id) continue;
          const dayVal = Number(rel?.publish_day?.value || 1);
          const idx = Math.max(0, Math.min(6, dayVal - 1));
          const item = mapAniLibertyItem(rel);
          const ep = entry?.published_release_episode;
          days[idx].push({
            ...item,
            airingInfo: ep?.ordinal ? `Ep ${ep.ordinal}` : rel?.publish_day?.description || '',
          });
        }
      }
    } catch {
      // Fallback gracefully if upstream temporarily fails.
    }
    return { days };
  });
}

// ---------------------------------------------------------------------------
// Detail Enrichment Helpers
// ---------------------------------------------------------------------------

async function findAniLibertyMatch(titles) {
  for (const raw of titles.filter(Boolean)) {
    const q = String(raw).trim();
    if (q.length < 2) continue;
    try {
      const rows = await cached(`al:match:${q.toLowerCase()}`, 15 * 60_000, () =>
        fetchJson(
          `https://aniliberty.top/api/v1/app/search/releases?query=${encodeURIComponent(q)}`,
          {
            timeoutMs: 6000,
          }
        )
      );
      if (Array.isArray(rows) && rows.length > 0 && rows[0]?.alias) {
        return fetchJson(
          `https://aniliberty.top/api/v1/anime/releases/${encodeURIComponent(rows[0].alias)}`,
          {
            timeoutMs: 7000,
          }
        );
      }
    } catch {
      // Try next title variant.
    }
  }
  return null;
}

async function findShikimoriEnrichment(shikiId, titles) {
  try {
    let id = shikiId;
    if (!id) {
      const candidates = [];
      for (const raw of titles.filter(Boolean)) {
        const clean = String(raw).trim();
        candidates.push(clean);
        const beforeColon = clean.split(':')[0].trim();
        if (beforeColon.length >= 3 && beforeColon !== clean) candidates.push(beforeColon);
      }
      for (const q of [...new Set(candidates)]) {
        const rows = await fetchJson(
          `https://shikimori.io/api/animes?search=${encodeURIComponent(q)}&limit=1`,
          { timeoutMs: 5500 }
        );
        if (Array.isArray(rows) && rows[0]?.id) {
          id = rows[0].id;
          break;
        }
      }
    }
    if (!id) return null;
    const [detail, shots, similar] = await Promise.allSettled([
      fetchJson(`https://shikimori.io/api/animes/${id}`, { timeoutMs: 6000 }),
      fetchJson(`https://shikimori.io/api/animes/${id}/screenshots`, { timeoutMs: 6000 }),
      fetchJson(`https://shikimori.io/api/animes/${id}/similar`, { timeoutMs: 6000 }),
    ]);
    const d = detail.status === 'fulfilled' ? detail.value : null;
    const screenshots =
      shots.status === 'fulfilled' && Array.isArray(shots.value)
        ? shots.value
            .slice(0, 12)
            .map(s => proxyImg(absUrl('https://shikimori.io', s.original || s.preview)))
            .filter(Boolean)
        : [];
    const similarItems =
      similar.status === 'fulfilled' && Array.isArray(similar.value)
        ? similar.value.slice(0, 12).map(r => mapShikimoriItem(r))
        : [];
    const ratingStats = Array.isArray(d?.rates_scores_stats)
      ? d.rates_scores_stats
          .map(x => ({ score: Number(x.name), count: Number(x.value) }))
          .filter(x => x.score >= 1 && x.score <= 10)
          .sort((a, b) => b.score - a.score)
      : [];
    const votesCount = ratingStats.reduce((sum, x) => sum + x.count, 0);
    const studios = Array.isArray(d?.studios)
      ? d.studios.map(s => s.filtered_name || s.name).filter(Boolean)
      : [];
    return {
      shikiId: id,
      score: Number.parseFloat(String(d?.score || '0')) || undefined,
      ratingStats,
      votesCount,
      screenshots,
      similar: similarItems,
      studio: studios.join(', ') || undefined,
      ageRating: d?.rating || undefined,
    };
  } catch {
    return null;
  }
}

async function searchRutubePlayableStreams(query, maxItems = 12) {
  try {
    const json = await cached(`rt:streams:${query.toLowerCase()}`, 10 * 60_000, () =>
      fetchJson(`https://rutube.ru/api/search/video/?query=${encodeURIComponent(query)}&page=1`, {
        timeoutMs: 6500,
      })
    );
    const raw = Array.isArray(json?.results) ? json.results : [];
    const filtered = raw.filter(v => Number(v?.duration || 0) >= 600 && v?.id);
    return (filtered.length ? filtered : raw.filter(v => v?.id)).slice(0, maxItems);
  } catch {
    return [];
  }
}

function mapAniLibertyEpisodes(data, mediaId) {
  return (Array.isArray(data?.episodes) ? data.episodes : []).map(ep => {
    const epId = ep.id || `ep-${ep.ordinal}`;
    const skips = [];
    if (
      ep.opening?.start != null &&
      ep.opening?.stop != null &&
      ep.opening.stop > ep.opening.start
    ) {
      skips.push({ kind: 'opening', from: ep.opening.start, to: ep.opening.stop });
    }
    if (ep.ending?.start != null && ep.ending?.stop != null && ep.ending.stop > ep.ending.start) {
      skips.push({ kind: 'ending', from: ep.ending.start, to: ep.ending.stop });
    }
    const thumbRaw =
      ep?.preview?.optimized?.preview ||
      ep?.preview?.optimized?.src ||
      ep?.preview?.preview ||
      ep?.preview?.src;
    const candidates = [];
    for (const [url, quality, preferred] of [
      [ep.hls_1080, '1080p', true],
      [ep.hls_720, '720p', false],
      [ep.hls_480, '480p', false],
    ]) {
      if (url && typeof url === 'string' && url.startsWith('https://')) {
        candidates.push({
          provider: 'aniliberty',
          mediaId,
          episodeId: epId,
          voiceLabel: 'AniLibria (RU)',
          quality,
          format: 'hls',
          url,
          preferred,
          skips,
          subtitles: [],
        });
      }
    }
    return {
      id: epId,
      season: 1,
      number: Number(ep.ordinal || 1),
      title: ep.name || `Episode ${ep.ordinal}`,
      durationSeconds: typeof ep.duration === 'number' ? ep.duration : undefined,
      thumbnailUrl: proxyImg(absUrl('https://aniliberty.top', thumbRaw)),
      skips,
      candidates,
    };
  });
}

async function loadMediaDetail(provider, id, locale = 'ru') {
  return cached(`detail:${provider}:${id}:${locale}`, 10 * 60_000, async () => {
    if (provider === 'aniliberty') {
      const data = await fetchJson(
        `https://aniliberty.top/api/v1/anime/releases/${encodeURIComponent(id)}`
      );
      const item = mapAniLibertyItem(data);
      const episodes = mapAniLibertyEpisodes(data, item.id);

      const [franchiseRes, shikiRes] = await Promise.allSettled([
        data?.id
          ? fetchJson(`https://aniliberty.top/api/v1/anime/franchises/release/${data.id}`, {
              timeoutMs: 5500,
            })
          : Promise.resolve([]),
        findShikimoriEnrichment(data?.shikimori || data?.mal, [
          data?.name?.english,
          data?.name?.main,
        ]),
      ]);

      const franchise = [];
      if (franchiseRes.status === 'fulfilled' && Array.isArray(franchiseRes.value)) {
        for (const group of franchiseRes.value) {
          const releases = Array.isArray(group?.franchise_releases) ? group.franchise_releases : [];
          for (const fr of releases) {
            const rel = fr?.release;
            if (!rel?.alias) continue;
            franchise.push({
              id: rel.alias,
              provider: 'aniliberty',
              title: rel?.name?.main || rel?.name?.english || rel.alias,
              year: rel?.year,
              kind: rel?.type?.description || rel?.type?.value,
              posterUrl: proxyImg(
                absUrl('https://aniliberty.top', rel?.poster?.optimized?.src || rel?.poster?.src)
              ),
              active: rel.alias === item.id,
            });
          }
        }
      }

      const shiki = shikiRes.status === 'fulfilled' ? shikiRes.value : null;
      if (shiki?.score) item.rating = shiki.score;
      if (shiki?.studio) item.studio = shiki.studio;
      if (shiki?.screenshots?.[0]) item.backdropUrl = shiki.screenshots[0];

      return {
        item,
        synopsis: stripHtml(data?.description || ''),
        status: data?.is_ongoing ? 'Ongoing' : 'Completed',
        voices: ['AniLibria (RU)'],
        episodes,
        backdropUrl: shiki?.screenshots?.[0] || item.backdropUrl,
        screenshots: shiki?.screenshots || [],
        ratingStats: shiki?.ratingStats || [],
        votesCount: shiki?.votesCount || Number(data?.added_in_users_favorites || 0),
        studio: shiki?.studio,
        ageRating: data?.age_rating?.label || shiki?.ageRating,
        runtimeMinutes: data?.average_duration_of_episode || undefined,
        country: 'Japan',
        franchise,
        similar: shiki?.similar || [],
      };
    }

    if (provider === 'shikimori') {
      const [d, shotsRes, simRes, relRes] = await Promise.allSettled([
        fetchJson(`https://shikimori.io/api/animes/${encodeURIComponent(id)}`),
        fetchJson(`https://shikimori.io/api/animes/${encodeURIComponent(id)}/screenshots`),
        fetchJson(`https://shikimori.io/api/animes/${encodeURIComponent(id)}/similar`),
        fetchJson(`https://shikimori.io/api/animes/${encodeURIComponent(id)}/related`),
      ]);
      if (d.status !== 'fulfilled') throw new Error('Shikimori title not found');
      const data = d.value;
      const item = mapShikimoriItem(data);
      const screenshots =
        shotsRes.status === 'fulfilled' && Array.isArray(shotsRes.value)
          ? shotsRes.value
              .slice(0, 12)
              .map(s => proxyImg(absUrl('https://shikimori.io', s.original || s.preview)))
              .filter(Boolean)
          : [];
      const similar =
        simRes.status === 'fulfilled' && Array.isArray(simRes.value)
          ? simRes.value.slice(0, 12).map(r => mapShikimoriItem(r))
          : [];
      const franchise =
        relRes.status === 'fulfilled' && Array.isArray(relRes.value)
          ? relRes.value
              .filter(r => r?.anime?.id)
              .slice(0, 12)
              .map(r => ({
                id: String(r.anime.id),
                provider: 'shikimori',
                title: r.anime.russian || r.anime.name,
                year: r.anime.aired_on ? Number(String(r.anime.aired_on).slice(0, 4)) : undefined,
                kind: r.relation_russian || r.relation,
                posterUrl: proxyImg(
                  absUrl('https://shikimori.io', r.anime.image?.original || r.anime.image?.preview)
                ),
                active: String(r.anime.id) === String(id),
              }))
          : [];

      const alMatch = await findAniLibertyMatch([data?.russian, data?.name]);
      let episodes = alMatch ? mapAniLibertyEpisodes(alMatch, item.id) : [];
      const voices = episodes.length ? ['AniLibria (RU)'] : [];
      if (episodes.length === 0) {
        const totalEps = Math.min(24, Math.max(1, Number(data?.episodes || 1)));
        const titleForSearch = data?.russian || data?.name || item.title;
        voices.push('Rutube (RU Auto)');
        episodes = Array.from({ length: totalEps }, (_, i) => ({
          id: `shiki-${id}-ep-${i + 1}`,
          season: 1,
          number: i + 1,
          title: `${titleForSearch} · Episode ${i + 1}`,
          thumbnailUrl: screenshots[i % Math.max(1, screenshots.length)] || item.posterUrl,
          skips: [],
          candidates: [
            {
              provider: 'rutube',
              mediaId: item.id,
              episodeId: `shiki-${id}-ep-${i + 1}`,
              voiceLabel: 'Rutube (RU Auto)',
              quality: 'Auto HD',
              format: 'hls',
              url: `rutube-search:${titleForSearch} ${i + 1} серия аниме||${data?.name || titleForSearch} episode ${i + 1}`,
              preferred: true,
              skips: [],
              subtitles: [],
            },
          ],
        }));
      }
      const ratingStats = Array.isArray(data?.rates_scores_stats)
        ? data.rates_scores_stats
            .map(x => ({ score: Number(x.name), count: Number(x.value) }))
            .filter(x => x.score >= 1 && x.score <= 10)
            .sort((a, b) => b.score - a.score)
        : [];
      const studios = Array.isArray(data?.studios)
        ? data.studios.map(s => s.filtered_name || s.name).filter(Boolean)
        : [];

      return {
        item: {
          ...item,
          backdropUrl: screenshots[0] || item.posterUrl,
          studio: studios.join(', ') || undefined,
        },
        synopsis: stripHtml(data?.description || ''),
        status: data?.status || undefined,
        voices,
        episodes,
        backdropUrl: screenshots[0] || item.posterUrl,
        screenshots,
        ratingStats,
        votesCount: ratingStats.reduce((sum, x) => sum + x.count, 0),
        studio: studios.join(', ') || undefined,
        ageRating: data?.rating || undefined,
        runtimeMinutes: data?.duration || undefined,
        country: 'Japan',
        trailerYoutubeId:
          Array.isArray(data?.videos) && data.videos[0]?.url
            ? String(data.videos[0].url).match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/)?.[1]
            : undefined,
        franchise,
        similar,
      };
    }

    if (provider === 'cinemeta') {
      const [rawType, rawImdb] = id.includes(':') ? id.split(':') : ['movie', id];
      const type = rawType === 'series' ? 'series' : 'movie';
      const json = await fetchJson(
        `https://v3-cinemeta.strem.io/meta/${type}/${encodeURIComponent(rawImdb)}.json`
      );
      const m = json?.meta;
      if (!m) throw new Error('Cinemeta title not found');
      const item = mapCinemetaItem(m, type === 'movie' ? 'movie' : 'series');

      const rtResults = await searchRutubePlayableStreams(
        type === 'movie' ? `${m.name} полный фильм` : `${m.name} 1 серия`,
        type === 'movie' ? 4 : 12
      );

      let episodes = [];
      const voices = new Set();

      if (type === 'movie') {
        const candidates = rtResults.map((v, idx) => ({
          provider: 'rutube',
          mediaId: item.id,
          episodeId: `movie-${rawImdb}`,
          voiceLabel: `Rutube HD #${idx + 1} (${Math.round((v.duration || 0) / 60)}m)`,
          quality: 'HD',
          format: 'hls',
          url: `rutube:${v.id}`,
          preferred: idx === 0,
          skips: [],
          subtitles: [],
        }));
        if (candidates.length === 0) {
          candidates.push({
            provider: 'rutube',
            mediaId: item.id,
            episodeId: `movie-${rawImdb}`,
            voiceLabel: 'Rutube Auto Search',
            quality: 'Auto HD',
            format: 'hls',
            url: `rutube-search:${m.name} полный фильм||${m.name} фильм`,
            preferred: true,
            skips: [],
            subtitles: [],
          });
        }
        candidates.forEach(c => voices.add(c.voiceLabel));
        episodes = [
          {
            id: `movie-${rawImdb}`,
            season: 1,
            number: 1,
            title: m.name,
            durationSeconds: Number.parseInt(String(m.runtime || '0'), 10) * 60 || undefined,
            thumbnailUrl: item.backdropUrl || item.posterUrl,
            skips: [],
            candidates,
          },
        ];
      } else {
        const videos = Array.isArray(m.videos) ? m.videos : [];
        episodes = videos
          .filter(v => Number(v.season || 0) > 0)
          .slice(0, 120)
          .map((v, idx) => {
            const epNum = Number(v.episode || idx + 1);
            const seasonNum = Number(v.season || 1);
            const rt = rtResults[idx];
            const candidates = rt
              ? [
                  {
                    provider: 'rutube',
                    mediaId: item.id,
                    episodeId: v.id || `s${seasonNum}e${epNum}`,
                    voiceLabel: 'Rutube (RU)',
                    quality: 'HD',
                    format: 'hls',
                    url: `rutube:${rt.id}`,
                    preferred: true,
                    skips: [],
                    subtitles: [],
                  },
                ]
              : [
                  {
                    provider: 'rutube',
                    mediaId: item.id,
                    episodeId: v.id || `s${seasonNum}e${epNum}`,
                    voiceLabel: 'Rutube (RU Auto)',
                    quality: 'Auto HD',
                    format: 'hls',
                    url: `rutube-search:${m.name} ${seasonNum} сезон ${epNum} серия||${m.name} ${epNum} серия`,
                    preferred: true,
                    skips: [],
                    subtitles: [],
                  },
                ];
            candidates.forEach(c => voices.add(c.voiceLabel));
            return {
              id: v.id || `s${seasonNum}e${epNum}`,
              season: seasonNum,
              number: epNum,
              title: v.name || v.title || `Episode ${epNum}`,
              thumbnailUrl: proxyImg(v.thumbnail) || item.backdropUrl,
              airDate: typeof v.released === 'string' ? v.released.slice(0, 10) : undefined,
              synopsis: stripHtml(v.overview || '').slice(0, 220) || undefined,
              skips: [],
              candidates,
            };
          });
      }

      const similarRes = await loadCinemetaCatalog(type, 'top', {
        page: 1,
        limit: 12,
        genre: m.genres?.[0],
      }).catch(() => ({ items: [] }));

      return {
        item,
        synopsis: stripHtml(m.description || ''),
        status: m.releaseInfo || 'Released',
        voices: [...voices],
        episodes,
        backdropUrl: item.backdropUrl,
        screenshots: [item.backdropUrl].filter(Boolean),
        ratingStats: [],
        trailerYoutubeId: Array.isArray(m.trailers) ? m.trailers[0]?.source : undefined,
        cast: Array.isArray(m.cast) ? m.cast.slice(0, 10) : [],
        director: Array.isArray(m.director) ? m.director.join(', ') : undefined,
        country: m.country || undefined,
        runtimeMinutes: Number.parseInt(String(m.runtime || '0'), 10) || undefined,
        franchise: [],
        similar: similarRes.items.filter(x => x.id !== item.id).slice(0, 10),
      };
    }

    if (provider === 'tvmaze') {
      const show = await fetchJson(
        `https://api.tvmaze.com/shows/${encodeURIComponent(id)}?embed[]=episodes&embed[]=cast&embed[]=images`
      );
      const curated = CURATED_TURKISH_TVMAZE_IDS.find(x => String(x.id) === String(id)) || {};
      const item = mapTvMazeShow(show, curated);
      const images = Array.isArray(show?._embedded?.images) ? show._embedded.images : [];
      const bgImg =
        images.find(i => i.type === 'background')?.resolutions?.original?.url ||
        images.find(i => i.type === 'banner')?.resolutions?.original?.url;
      const backdropUrl = proxyImg(bgImg) || item.posterUrl;
      const screenshots = images
        .map(i => proxyImg(i?.resolutions?.original?.url || i?.resolutions?.medium?.url))
        .filter(Boolean)
        .slice(0, 10);

      const rtQuery = curated.ruTitle
        ? `${curated.ruTitle} серия русская озвучка`
        : `${show.name} 1 серия`;
      const rtHits = await searchRutubePlayableStreams(rtQuery, 16);

      const rawEps = Array.isArray(show?._embedded?.episodes) ? show._embedded.episodes : [];
      const voices = new Set();
      const episodes = rawEps.slice(0, 150).map((ep, idx) => {
        const epNum = Number(ep.number || idx + 1);
        const rt = rtHits[idx];
        const voiceName = curated.ruTitle ? 'Русская озвучка (Rutube)' : 'Rutube HD';
        const candidates = rt
          ? [
              {
                provider: 'rutube',
                mediaId: item.id,
                episodeId: String(ep.id),
                voiceLabel: voiceName,
                quality: 'HD',
                format: 'hls',
                url: `rutube:${rt.id}`,
                preferred: true,
                skips: [],
                subtitles: [],
              },
            ]
          : [
              {
                provider: 'rutube',
                mediaId: item.id,
                episodeId: String(ep.id),
                voiceLabel: voiceName,
                quality: 'Auto HD',
                format: 'hls',
                url: curated.ruTitle
                  ? `rutube-search:${curated.ruTitle} ${epNum} серия русская озвучка||${show.name} ${epNum} bölüm`
                  : `rutube-search:${show.name} ${epNum} серия||${show.name} episode ${epNum}`,
                preferred: true,
                skips: [],
                subtitles: [],
              },
            ];
        candidates.forEach(c => voices.add(c.voiceLabel));
        return {
          id: String(ep.id),
          season: Number(ep.season || 1),
          number: epNum,
          title: ep.name || `Episode ${epNum}`,
          durationSeconds: ep.runtime ? ep.runtime * 60 : undefined,
          thumbnailUrl: proxyImg(ep?.image?.original || ep?.image?.medium) || backdropUrl,
          airDate: ep.airdate || undefined,
          synopsis: stripHtml(ep.summary || '').slice(0, 220) || undefined,
          skips: [],
          candidates,
        };
      });

      // If TVMaze had zero episodes listed yet, expose found Rutube episodes directly
      if (episodes.length === 0 && rtHits.length > 0) {
        rtHits.forEach((rt, idx) => {
          const voice = curated.ruTitle ? 'Русская озвучка (Rutube)' : 'Rutube HD';
          voices.add(voice);
          episodes.push({
            id: rt.id,
            season: 1,
            number: idx + 1,
            title: rt.title,
            durationSeconds: rt.duration || undefined,
            thumbnailUrl: proxyImg(rt.thumbnail_url) || backdropUrl,
            skips: [],
            candidates: [
              {
                provider: 'rutube',
                mediaId: item.id,
                episodeId: rt.id,
                voiceLabel: voice,
                quality: 'HD',
                format: 'hls',
                url: `rutube:${rt.id}`,
                preferred: true,
                skips: [],
                subtitles: [],
              },
            ],
          });
        });
      }

      const cast = Array.isArray(show?._embedded?.cast)
        ? show._embedded.cast
            .slice(0, 10)
            .map(c =>
              c?.character?.name ? `${c.person?.name} (${c.character.name})` : c.person?.name
            )
            .filter(Boolean)
        : [];
      const similar =
        item.category === 'turkish-dizi'
          ? (await loadTurkishDizis()).filter(x => x.id !== item.id).slice(0, 10)
          : [];

      return {
        item: { ...item, backdropUrl },
        synopsis: stripHtml(show?.summary || ''),
        status: show?.status || undefined,
        voices: [...voices],
        episodes,
        backdropUrl,
        screenshots,
        ratingStats: [],
        cast,
        country: item.country,
        studio: show?.network?.name || show?.webChannel?.name || undefined,
        runtimeMinutes: show?.averageRuntime || show?.runtime || undefined,
        franchise: [],
        similar,
      };
    }

    if (provider === 'rutube') {
      const opts = await fetchJson(
        `https://rutube.ru/api/play/options/${encodeURIComponent(id)}/?format=json`
      );
      const m3u8 = opts?.video_balancer?.m3u8;
      const posterUrl = proxyImg(opts?.thumbnail_url);
      const item = {
        id,
        provider: 'rutube',
        category: 'movie',
        title: opts?.title || id,
        year: undefined,
        posterUrl,
        backdropUrl: posterUrl,
        genres: [opts?.category?.name || 'Russian Cinema'].filter(Boolean),
        badges: ['Rutube HD', 'HLS', 'RU'],
        audioLanguages: ['RU'],
        externalIds: { rutube: id },
        streamReady: Boolean(m3u8),
        sources: [{ provider: 'rutube', id, label: 'Rutube HLS' }],
      };
      const candidates = m3u8
        ? [
            {
              provider: 'rutube',
              mediaId: id,
              episodeId: id,
              voiceLabel: opts?.author?.name || 'Rutube (RU)',
              quality: 'Auto HD',
              format: 'hls',
              url: m3u8,
              preferred: true,
              skips: [],
              subtitles: [],
            },
          ]
        : [];
      const related = await loadRutubeCatalog(
        String(opts?.title || 'полный фильм')
          .split(/\s+/)
          .slice(0, 3)
          .join(' '),
        'movie',
        1
      ).catch(() => ({ items: [] }));
      return {
        item,
        synopsis: stripHtml(opts?.description || ''),
        status: 'Free HD Stream',
        voices: candidates.length ? [candidates[0].voiceLabel] : [],
        episodes: [
          {
            id,
            season: 1,
            number: 1,
            title: item.title,
            durationSeconds: opts?.duration ? Math.round(opts.duration / 1000) : undefined,
            thumbnailUrl: posterUrl,
            skips: [],
            candidates,
          },
        ],
        backdropUrl: posterUrl,
        screenshots: posterUrl ? [posterUrl] : [],
        ratingStats: [],
        studio: opts?.author?.name || undefined,
        country: 'Russia',
        franchise: [],
        similar: related.items.filter(x => x.id !== id).slice(0, 10),
      };
    }

    if (provider === 'livetv') {
      const ch = CURATED_LIVE_CHANNELS.find(c => c.id === id);
      if (!ch) throw new Error('Live channel not found');
      const item = mapLiveChannel(ch);
      return {
        item,
        synopsis: `${ch.title} — Official free-to-air live HLS broadcast (${ch.country}, ${ch.lang}).`,
        status: 'LIVE',
        voices: [`Live (${ch.lang})`],
        episodes: [
          {
            id: ch.id,
            season: 1,
            number: 1,
            title: `${ch.title} — Live Broadcast`,
            thumbnailUrl: item.posterUrl,
            skips: [],
            candidates: [
              {
                provider: 'livetv',
                mediaId: ch.id,
                episodeId: ch.id,
                voiceLabel: `Live (${ch.lang})`,
                quality: 'LIVE HD',
                format: 'hls',
                url: ch.url,
                preferred: true,
                skips: [],
                subtitles: [],
              },
            ],
          },
        ],
        backdropUrl: item.posterUrl,
        screenshots: [],
        ratingStats: [],
        country: ch.country,
        franchise: [],
        similar: CURATED_LIVE_CHANNELS.filter(c => c.id !== id).map(c => mapLiveChannel(c)),
      };
    }

    throw new Error(`Unsupported provider: ${provider}`);
  });
}

// ---------------------------------------------------------------------------
// HLS Manifest Rewriter & Secure Proxies
// ---------------------------------------------------------------------------

export function rewriteHlsManifest(text, baseUrl) {
  return text
    .split(/\r?\n/)
    .map(line => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith('#')) {
        return line.replace(/URI="([^"]+)"/g, (_m, uri) => {
          try {
            const abs = new URL(uri, baseUrl).toString();
            if (!isHostAllowed(abs, ALLOWED_MEDIA_SUFFIXES)) return `URI="${uri}"`;
            return `URI="${proxyHls(abs)}"`;
          } catch {
            return `URI="${uri}"`;
          }
        });
      }
      try {
        const abs = new URL(trimmed, baseUrl).toString();
        if (!isHostAllowed(abs, ALLOWED_MEDIA_SUFFIXES)) return line;
        return proxyHls(abs);
      } catch {
        return line;
      }
    })
    .join('\n');
}

async function resolveRutubeVideoId(videoId) {
  try {
    const opts = await cached(`rt:play:${videoId}`, 2 * 60_000, () =>
      fetchJson(`https://rutube.ru/api/play/options/${encodeURIComponent(videoId)}/?format=json`, {
        timeoutMs: 7000,
      })
    );
    return opts?.video_balancer?.m3u8 || '';
  } catch {
    return '';
  }
}

async function resolveStremioAddonStreams(addons, { imdbId, mediaType, season, episode } = {}) {
  if (!Array.isArray(addons) || !addons.length || !imdbId || !/^tt\d+$/.test(imdbId)) return [];
  const type = mediaType === 'series' ? 'series' : 'movie';
  const streamId =
    type === 'series' && season && episode ? `${imdbId}:${season}:${episode}` : imdbId;
  const out = [];
  await Promise.allSettled(
    addons.slice(0, 6).map(async manifestUrl => {
      if (typeof manifestUrl !== 'string' || !manifestUrl.startsWith('https://')) return;
      const base = manifestUrl.replace(/\/manifest\.json$/i, '').replace(/\/$/, '');
      const u = new URL(base);
      if (u.hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(u.hostname)) return;
      const data = await fetchJson(`${base}/stream/${type}/${encodeURIComponent(streamId)}.json`, {
        timeoutMs: 6500,
      });
      const list = Array.isArray(data?.streams) ? data.streams : [];
      for (const s of list.slice(0, 4)) {
        const directUrl = typeof s?.url === 'string' ? s.url : '';
        if (!directUrl.startsWith('https://')) continue;
        const format = directUrl.toLowerCase().includes('.m3u8')
          ? 'hls'
          : directUrl.toLowerCase().includes('.mpd')
            ? 'dash'
            : 'mp4';
        out.push({
          provider: `addon:${u.hostname}`,
          quality: String(s.name || s.title || 'Addon HD').slice(0, 24),
          format,
          url: directUrl,
          relayed: false,
          sourceHost: new URL(directUrl).hostname,
          voiceLabel: String(s.title || s.name || u.hostname)
            .split('\n')[0]
            .slice(0, 48),
          skips: [],
          subtitles: [],
        });
      }
    })
  );
  return out;
}

async function resolveCandidates(candidates, context = {}) {
  const streams = [];
  const subtitlesPromise = fetchOpenSubtitles(
    context.mediaType || 'movie',
    context.imdbId,
    context.season,
    context.episode
  );
  const addonStreamsPromise = resolveStremioAddonStreams(context.addons, context);

  for (const c of Array.isArray(candidates) ? candidates : []) {
    let url = c.url;
    if (typeof url === 'string' && url.startsWith('rutube:')) {
      url = await resolveRutubeVideoId(url.slice('rutube:'.length));
    } else if (typeof url === 'string' && url.startsWith('rutube-search:')) {
      const queries = url
        .slice('rutube-search:'.length)
        .split('||')
        .map(s => s.trim())
        .filter(Boolean);
      url = '';
      for (const q of queries) {
        const hits = await searchRutubePlayableStreams(q, 3);
        for (const h of hits) {
          const m3u8 = await resolveRutubeVideoId(h.id);
          if (m3u8) {
            url = m3u8;
            break;
          }
        }
        if (url) break;
      }
    }
    if (!url || !url.startsWith('https://')) continue;
    const host = new URL(url).hostname;
    const shouldProxy =
      c.format === 'hls' &&
      isHostAllowed(url, ALLOWED_MEDIA_SUFFIXES) &&
      (host.includes('rutube') ||
        host.includes('rtbcdn') ||
        host.includes('trt.com.tr') ||
        host.includes('libria.fun'));

    streams.push({
      provider: c.provider,
      quality: c.quality || 'HD',
      format: c.format || 'hls',
      url: shouldProxy ? proxyHls(url) : url,
      relayed: shouldProxy,
      sourceHost: host,
      voiceLabel: c.voiceLabel || c.provider,
      skips: c.skips || [],
      subtitles: c.subtitles || [],
    });
  }

  const [autoSubs, addonStreams] = await Promise.all([subtitlesPromise, addonStreamsPromise]);
  const allStreams = [...streams, ...addonStreams].map(s => ({
    ...s,
    subtitles: s.subtitles?.length ? s.subtitles : autoSubs,
  }));

  return {
    provider: allStreams[0]?.provider || candidates?.[0]?.provider || 'wachcha',
    episodeId: candidates?.[0]?.episodeId || '',
    streams: allStreams,
  };
}

// ---------------------------------------------------------------------------
// HTTP Helpers & Router
// ---------------------------------------------------------------------------

async function fetchAllowed(target, allowedSuffixes, { timeoutMs = 12000, headers = {} } = {}) {
  let current = target;
  for (let hop = 0; hop < 3; hop += 1) {
    if (!isHostAllowed(current, allowedSuffixes)) {
      throw new Error('Upstream host not allowlisted');
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let resp;
    try {
      resp = await fetch(current, {
        signal: ctrl.signal,
        redirect: 'manual',
        headers: { 'User-Agent': USER_AGENT, ...headers },
      });
    } finally {
      clearTimeout(timer);
    }
    if (resp.status >= 300 && resp.status < 400) {
      const loc = resp.headers.get('location');
      if (!loc) return { resp, finalUrl: current };
      current = new URL(loc, current).toString();
      continue;
    }
    return { resp, finalUrl: current };
  }
  throw new Error('Too many upstream redirects');
}

function sendJson(res, status, data, cacheControl = 'public, max-age=60') {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': cacheControl,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(body);
}

async function readBodyJson(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > 256 * 1024) throw new Error('Payload too large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

async function handleApi(req, res, urlObj) {
  const path = urlObj.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  if (path === '/api/health') {
    sendJson(
      res,
      200,
      {
        ok: true,
        version: '0.2.0',
        cacheEntries: cache.size,
        providers: [
          'aniliberty',
          'shikimori',
          'cinemeta',
          'tvmaze',
          'rutube',
          'turkish_channels',
          'livetv',
        ],
      },
      'no-store'
    );
    return;
  }

  if (path === '/api/home') {
    const data = await cached('home:v2', 4 * 60_000, async () => {
      const [alTop, alLatest, shikiTop, cmMovies, cmSeries, rtRu, trDizis] =
        await Promise.allSettled([
          loadAniLibertyTop({ page: 1, limit: 18, sort: 'RATING_DESC' }),
          loadAniLibertyLatest(18),
          loadShikimoriTop({ page: 1, limit: 18, order: 'ranked' }),
          loadCinemetaCatalog('movie', 'imdbRating', { page: 1, limit: 18 }),
          loadCinemetaCatalog('series', 'top', { page: 1, limit: 18 }),
          loadRutubeCatalog('полный фильм hd', 'movie', 1),
          loadTurkishDizis(),
        ]);

      const shelves = [];
      if (alTop.status === 'fulfilled' && alTop.value.items.length) {
        shelves.push({
          id: 'top-anime',
          titleKey: 'shelf.topAnime',
          providerBadge: 'AniLiberty Top · 1080p HLS',
          category: 'anime',
          items: alTop.value.items,
        });
      }
      if (alLatest.status === 'fulfilled' && alLatest.value.length) {
        shelves.push({
          id: 'trending-anime',
          titleKey: 'shelf.trendingAnime',
          providerBadge: 'AniLiberty · New Episodes',
          category: 'anime',
          items: alLatest.value,
        });
      }
      if (trDizis.status === 'fulfilled' && trDizis.value.length) {
        shelves.push({
          id: 'turkish-dizis',
          titleKey: 'shelf.turkishDizis',
          providerBadge: 'TVMaze TR · Rutube RU Dub',
          category: 'turkish-dizi',
          items: trDizis.value,
        });
      }
      if (cmMovies.status === 'fulfilled' && cmMovies.value.items.length) {
        shelves.push({
          id: 'top-movies',
          titleKey: 'shelf.topMovies',
          providerBadge: 'IMDb Top Movies · HD',
          category: 'movie',
          items: cmMovies.value.items,
        });
      }
      if (rtRu.status === 'fulfilled' && rtRu.value.items.length) {
        shelves.push({
          id: 'russian-cinema',
          titleKey: 'shelf.russianCinema',
          providerBadge: 'Rutube Free HD · Direct HLS',
          category: 'movie',
          items: rtRu.value.items,
        });
      }
      if (cmSeries.status === 'fulfilled' && cmSeries.value.items.length) {
        shelves.push({
          id: 'top-series',
          titleKey: 'shelf.topSeries',
          providerBadge: 'World TV Top · Full Seasons',
          category: 'series',
          items: cmSeries.value.items,
        });
      }
      if (shikiTop.status === 'fulfilled' && shikiTop.value.items.length) {
        shelves.push({
          id: 'shikimori-top',
          titleKey: 'shelf.shikimoriTop',
          providerBadge: 'Shikimori Top-100 · Auto HLS',
          category: 'anime',
          items: shikiTop.value.items,
        });
      }
      shelves.push({
        id: 'live-tv',
        titleKey: 'shelf.liveTv',
        providerBadge: 'Free-to-Air · Live HLS',
        category: 'live-tv',
        items: CURATED_LIVE_CHANNELS.map((c, i) => mapLiveChannel(c, i + 1)),
      });
      return shelves;
    });
    sendJson(res, 200, data);
    return;
  }

  if (path === '/api/tops' || path === '/api/catalog') {
    const vertical =
      urlObj.searchParams.get('vertical') || urlObj.searchParams.get('category') || 'anime';
    const page = Math.max(1, Number(urlObj.searchParams.get('page') || 1));
    const sort = urlObj.searchParams.get('sort') || 'rating';
    const genre = urlObj.searchParams.get('genre') || '';
    const year = urlObj.searchParams.get('year') || '';
    const minRating = Number(urlObj.searchParams.get('minRating') || 0);

    let result = { items: [], page, total: 0, hasMore: false };
    if (vertical === 'anime' || vertical === 'ongoing') {
      const sortMap = {
        rating: 'RATING_DESC',
        popular: 'RATING_DESC',
        newest: 'FRESH_AT_DESC',
        year: 'YEAR_DESC',
      };
      result = await loadAniLibertyTop({
        page,
        limit: 24,
        sort: sortMap[sort] || 'RATING_DESC',
        genre,
        year,
        ongoingOnly: vertical === 'ongoing',
      });
    } else if (vertical === 'shikimori') {
      const orderMap = {
        rating: 'ranked',
        popular: 'popularity',
        newest: 'aired_on',
        year: 'aired_on',
      };
      result = await loadShikimoriTop({ page, limit: 24, order: orderMap[sort] || 'ranked' });
    } else if (vertical === 'movie') {
      const cat = sort === 'popular' ? 'top' : 'imdbRating';
      result = await loadCinemetaCatalog('movie', cat, { page, limit: 24, genre });
    } else if (vertical === 'series') {
      const cat = sort === 'rating' ? 'imdbRating' : 'top';
      result = await loadCinemetaCatalog('series', cat, { page, limit: 24, genre });
    } else if (vertical === 'russian') {
      const q = genre ? `${genre} полный фильм` : 'полный фильм hd';
      result = await loadRutubeCatalog(q, 'movie', page);
    } else if (vertical === 'turkish-dizi') {
      const all = await loadTurkishDizis();
      result = { items: all, page: 1, total: all.length, hasMore: false };
    } else if (vertical === 'live-tv') {
      const all = CURATED_LIVE_CHANNELS.map((c, i) => mapLiveChannel(c, i + 1));
      result = { items: all, page: 1, total: all.length, hasMore: false };
    } else {
      // 'all' mixed paginated catalog
      const [al, mv, tr] = await Promise.allSettled([
        loadAniLibertyTop({ page, limit: 12 }),
        loadCinemetaCatalog('movie', 'imdbRating', { page, limit: 12 }),
        page === 1 ? loadTurkishDizis() : Promise.resolve([]),
      ]);
      const merged = [
        ...(al.status === 'fulfilled' ? al.value.items : []),
        ...(mv.status === 'fulfilled' ? mv.value.items : []),
        ...(tr.status === 'fulfilled' ? tr.value : []),
      ];
      result = { items: merged, page, total: 500, hasMore: true };
    }

    let items = result.items;
    if (year && vertical !== 'anime' && vertical !== 'ongoing') {
      const y = Number(year);
      items = items.filter(i => i.year === y);
    }
    if (minRating > 0) {
      items = items.filter(i => (i.rating || 0) >= minRating);
    }
    if (genre && !/^\d+$/.test(genre) && vertical !== 'movie' && vertical !== 'series') {
      const gLow = genre.toLowerCase();
      items = items.filter(i => i.genres.some(g => g.toLowerCase().includes(gLow)));
    }

    sendJson(res, 200, { ...result, items });
    return;
  }

  if (path === '/api/genres') {
    const category = urlObj.searchParams.get('category') || 'anime';
    if (category === 'anime' || category === 'ongoing') {
      const genres = await loadAniLibertyGenres().catch(() => []);
      sendJson(res, 200, genres, 'public, max-age=3600');
      return;
    }
    const common = [
      'Action',
      'Drama',
      'Comedy',
      'Thriller',
      'Sci-Fi',
      'Crime',
      'Romance',
      'History',
      'Fantasy',
      'Adventure',
      'Horror',
      'Documentary',
    ].map(name => ({ id: name, name }));
    sendJson(res, 200, common, 'public, max-age=3600');
    return;
  }

  if (path === '/api/schedule') {
    const data = await loadWeeklySchedule();
    sendJson(res, 200, data);
    return;
  }

  if (path === '/api/search') {
    const q = (urlObj.searchParams.get('q') || '').trim();
    const category = urlObj.searchParams.get('category') || '';
    if (!q) {
      sendJson(res, 200, { query: '', items: [], providerErrors: [] });
      return;
    }

    const errors = [];
    const [alRes, shikiRes, cmMovieRes, cmSeriesRes, tvRes, rtRes, trList] =
      await Promise.allSettled([
        fetchJson(
          `https://aniliberty.top/api/v1/app/search/releases?query=${encodeURIComponent(q)}`,
          {
            timeoutMs: 6500,
          }
        ),
        fetchJson(`https://shikimori.io/api/animes?search=${encodeURIComponent(q)}&limit=12`, {
          timeoutMs: 6500,
        }),
        fetchJson(
          `https://v3-cinemeta.strem.io/catalog/movie/top/search=${encodeURIComponent(q)}.json`,
          {
            timeoutMs: 6500,
          }
        ),
        fetchJson(
          `https://v3-cinemeta.strem.io/catalog/series/top/search=${encodeURIComponent(q)}.json`,
          {
            timeoutMs: 6500,
          }
        ),
        fetchJson(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(q)}`, {
          timeoutMs: 6500,
        }),
        fetchJson(`https://rutube.ru/api/search/video/?query=${encodeURIComponent(q)}&page=1`, {
          timeoutMs: 6500,
        }),
        loadTurkishDizis(),
      ]);

    const items = [];
    const seen = new Set();
    const pushUnique = item => {
      const key =
        item.externalIds?.imdb ||
        (item.externalIds?.shikimori ? `shiki:${item.externalIds.shikimori}` : null) ||
        `${item.provider}:${item.id}`;
      if (seen.has(key)) return;
      seen.add(key);
      items.push(item);
    };

    if (alRes.status === 'fulfilled' && Array.isArray(alRes.value)) {
      alRes.value.slice(0, 16).forEach(r => pushUnique(mapAniLibertyItem(r)));
    } else if (alRes.status === 'rejected') {
      errors.push(`aniliberty: ${alRes.reason?.message || 'error'}`);
    }

    if (trList.status === 'fulfilled') {
      const ql = q.toLowerCase();
      trList.value
        .filter(
          d =>
            d.title.toLowerCase().includes(ql) ||
            (d.originalTitle || '').toLowerCase().includes(ql) ||
            ql.includes('dizi') ||
            ql.includes('турец')
        )
        .forEach(pushUnique);
    }

    if (cmMovieRes.status === 'fulfilled' && Array.isArray(cmMovieRes.value?.metas)) {
      cmMovieRes.value.metas.slice(0, 12).forEach(m => pushUnique(mapCinemetaItem(m, 'movie')));
    }
    if (cmSeriesRes.status === 'fulfilled' && Array.isArray(cmSeriesRes.value?.metas)) {
      cmSeriesRes.value.metas.slice(0, 12).forEach(m => pushUnique(mapCinemetaItem(m, 'series')));
    }
    if (shikiRes.status === 'fulfilled' && Array.isArray(shikiRes.value)) {
      shikiRes.value.slice(0, 10).forEach(r => pushUnique(mapShikimoriItem(r)));
    }
    if (tvRes.status === 'fulfilled' && Array.isArray(tvRes.value)) {
      tvRes.value
        .slice(0, 12)
        .filter(r => r?.show?.id)
        .forEach(r => pushUnique(mapTvMazeShow(r.show)));
    }
    if (rtRes.status === 'fulfilled' && Array.isArray(rtRes.value?.results)) {
      rtRes.value.results
        .filter(v => v?.thumbnail_url && Number(v?.duration || 0) >= 600)
        .slice(0, 12)
        .forEach(v => pushUnique(mapRutubeItem(v, 'movie')));
    }

    const ql = q.toLowerCase();
    CURATED_LIVE_CHANNELS.filter(
      c =>
        c.title.toLowerCase().includes(ql) ||
        c.country.toLowerCase().includes(ql) ||
        ql.includes('live') ||
        ql.includes('tv')
    ).forEach(c => pushUnique(mapLiveChannel(c)));

    const filtered = category ? items.filter(i => i.category === category) : items;
    sendJson(res, 200, { query: q, items: filtered, providerErrors: errors }, 'public, max-age=30');
    return;
  }

  const detailMatch = /^\/api\/detail\/([^/]+)\/(.+)$/.exec(path);
  if (detailMatch) {
    const provider = decodeURIComponent(detailMatch[1]);
    const id = decodeURIComponent(detailMatch[2]);
    const locale = urlObj.searchParams.get('locale') || 'ru';
    const detail = await loadMediaDetail(provider, id, locale);
    sendJson(res, 200, detail);
    return;
  }

  if (path === '/api/resolve' && req.method === 'POST') {
    const body = await readBodyJson(req);
    const resolved = await resolveCandidates(body.candidates || [], {
      addons: body.addons,
      imdbId: body.imdbId,
      mediaType: body.mediaType,
      season: body.season,
      episode: body.episode,
    });
    sendJson(res, 200, resolved, 'no-store');
    return;
  }

  if (path === '/api/stremio/manifest') {
    const manifestUrl = urlObj.searchParams.get('url') || '';
    if (!manifestUrl.startsWith('https://') || !manifestUrl.endsWith('manifest.json')) {
      sendJson(
        res,
        400,
        { error: 'Manifest URL must be HTTPS and end with /manifest.json' },
        'no-store'
      );
      return;
    }
    const u = new URL(manifestUrl);
    if (u.hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(u.hostname)) {
      sendJson(res, 403, { error: 'Private hosts are blocked' }, 'no-store');
      return;
    }
    const manifest = await fetchJson(manifestUrl, { timeoutMs: 8000 });
    if (!manifest?.id || !manifest?.name) {
      sendJson(res, 422, { error: 'Invalid Stremio manifest JSON' }, 'no-store');
      return;
    }
    sendJson(
      res,
      200,
      {
        id: String(manifest.id),
        name: String(manifest.name),
        version: String(manifest.version || '1.0.0'),
        description: String(manifest.description || ''),
        resources: Array.isArray(manifest.resources)
          ? manifest.resources.map(r => (typeof r === 'string' ? r : r?.name)).filter(Boolean)
          : [],
        types: Array.isArray(manifest.types) ? manifest.types.map(String) : ['movie', 'series'],
        manifestUrl,
      },
      'public, max-age=300'
    );
    return;
  }

  if (path === '/api/sub') {
    const target = urlObj.searchParams.get('url') || '';
    if (!isHostAllowed(target, ALLOWED_SUBTITLE_SUFFIXES)) {
      sendJson(res, 403, { error: 'Subtitle host not allowlisted' }, 'no-store');
      return;
    }
    const { resp: upstream } = await fetchAllowed(target, ALLOWED_SUBTITLE_SUFFIXES, {
      timeoutMs: 9000,
    });
    if (!upstream.ok) {
      res.writeHead(upstream.status);
      res.end();
      return;
    }
    const raw = await upstream.text();
    const vtt = srtToVtt(raw);
    res.writeHead(200, {
      'Content-Type': 'text/vtt; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(vtt);
    return;
  }

  if (path === '/api/img') {
    const target = urlObj.searchParams.get('url') || '';
    if (!isHostAllowed(target, ALLOWED_IMAGE_SUFFIXES)) {
      sendJson(res, 403, { error: 'Image host not allowlisted' }, 'no-store');
      return;
    }
    const { resp: upstream } = await fetchAllowed(target, ALLOWED_IMAGE_SUFFIXES, {
      timeoutMs: 9000,
      headers: { Accept: 'image/*,*/*;q=0.8' },
    });
    if (!upstream.ok) {
      res.writeHead(upstream.status);
      res.end();
      return;
    }
    const len = Number(upstream.headers.get('content-length') || 0);
    if (len > MAX_IMAGE_BYTES) {
      res.writeHead(413);
      res.end();
      return;
    }
    const buf = Buffer.from(await upstream.arrayBuffer());
    if (buf.length > MAX_IMAGE_BYTES) {
      res.writeHead(413);
      res.end();
      return;
    }
    res.writeHead(200, {
      'Content-Type': upstream.headers.get('content-type') || 'image/jpeg',
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(buf);
    return;
  }

  if (path === '/api/hls') {
    const target = urlObj.searchParams.get('url') || '';
    if (!isHostAllowed(target, ALLOWED_MEDIA_SUFFIXES)) {
      sendJson(res, 403, { error: 'Media host not allowlisted' }, 'no-store');
      return;
    }
    if (req.method === 'HEAD') {
      const isM3u8 = target.toLowerCase().includes('.m3u8');
      res.writeHead(200, {
        'Content-Type': isM3u8 ? 'application/vnd.apple.mpegurl; charset=utf-8' : 'video/mp2t',
        'Access-Control-Allow-Origin': '*',
        'Accept-Ranges': 'bytes',
      });
      res.end();
      return;
    }
    const headers = {};
    if (req.headers.range) headers.Range = String(req.headers.range);
    const { resp: upstream, finalUrl } = await fetchAllowed(target, ALLOWED_MEDIA_SUFFIXES, {
      timeoutMs: 15000,
      headers,
    });
    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const isPlaylist =
      finalUrl.toLowerCase().includes('.m3u8') || contentType.toLowerCase().includes('mpegurl');

    if (!upstream.ok && upstream.status !== 206) {
      res.writeHead(upstream.status, { 'Access-Control-Allow-Origin': '*' });
      res.end();
      return;
    }

    if (isPlaylist) {
      const text = await upstream.text();
      if (Buffer.byteLength(text, 'utf8') > MAX_PLAYLIST_BYTES) {
        res.writeHead(413);
        res.end();
        return;
      }
      const rewritten = rewriteHlsManifest(text, finalUrl);
      res.writeHead(200, {
        'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(rewritten);
      return;
    }

    const len = Number(upstream.headers.get('content-length') || 0);
    if (len > MAX_SEGMENT_BYTES) {
      res.writeHead(413);
      res.end();
      return;
    }
    const buf = Buffer.from(await upstream.arrayBuffer());
    const outHeaders = {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=120',
      'Access-Control-Allow-Origin': '*',
      'Accept-Ranges': 'bytes',
    };
    const cr = upstream.headers.get('content-range');
    if (cr) outHeaders['Content-Range'] = cr;
    res.writeHead(upstream.status, outHeaders);
    res.end(buf);
    return;
  }

  sendJson(res, 404, { error: 'Not found' }, 'no-store');
}

async function serveStatic(res, pathname) {
  const safePath = normalize(pathname === '/' ? '/index.html' : pathname).replace(
    /^(\.\.[/\\])+/,
    ''
  );
  let filePath = join(DIST_DIR, safePath);
  try {
    const st = await stat(filePath);
    if (st.isDirectory()) filePath = join(filePath, 'index.html');
  } catch {
    filePath = join(DIST_DIR, 'index.html');
  }

  const ext = extname(filePath).toLowerCase();
  const data = await readFile(filePath);
  res.writeHead(200, {
    'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
    'Cache-Control':
      ext === '.html' || filePath.endsWith('sw.js')
        ? 'no-cache'
        : 'public, max-age=31536000, immutable',
  });
  res.end(data);
}

export function createWachchaServer() {
  return http.createServer(async (req, res) => {
    try {
      const urlObj = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      if (urlObj.pathname.startsWith('/api/')) {
        await handleApi(req, res, urlObj);
      } else {
        await serveStatic(res, urlObj.pathname);
      }
    } catch (err) {
      if (!res.headersSent) {
        sendJson(
          res,
          502,
          { error: err instanceof Error ? err.message : 'Upstream error' },
          'no-store'
        );
      } else {
        res.end();
      }
    }
  });
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) ===
    resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/i, '$1'))
) {
  const server = createWachchaServer();
  server.listen(PORT, HOST, () => {
    console.log(`Wachcha server listening on http://${HOST}:${PORT} (dist: ${DIST_DIR})`);
  });
}
