/**
 * Bounded FIFO image fetch queue (max 6 active, max 2 background revalidations)
 * storing WebKit-safe ArrayBuffer + MIME entries and deduplicating identical URLs.
 */

import { peekImageCache, putImageCache } from './cache-store';
import { fetchImageNative, isTauriRuntime } from './desktop';

const MAX_ACTIVE = 6;
const MAX_BACKGROUND = 2;

interface QueueTask {
  url: string;
  background: boolean;
  resolve: (src: string | null) => void;
  cancelled: boolean;
}

const blobUrls = new Map<string, string>();
const queue: QueueTask[] = [];
let activeCount = 0;
let bgActiveCount = 0;

function bufferToBlobUrl(url: string, buffer: ArrayBuffer, mime: string): string {
  const existing = blobUrls.get(url);
  if (existing) URL.revokeObjectURL(existing);
  const objUrl = URL.createObjectURL(new Blob([buffer], { type: mime }));
  blobUrls.set(url, objUrl);
  return objUrl;
}

function drain() {
  for (let i = 0; i < queue.length;) {
    if (activeCount >= MAX_ACTIVE) break;
    const task = queue[i];
    if (task.cancelled) {
      queue.splice(i, 1);
      continue;
    }
    if (task.background && bgActiveCount >= MAX_BACKGROUND) {
      i++;
      continue;
    }
    queue.splice(i, 1);
    activeCount++;
    if (task.background) bgActiveCount++;

    runFetch(task.url)
      .then(src => task.resolve(src))
      .catch(() => task.resolve(null))
      .finally(() => {
        activeCount--;
        if (task.background) bgActiveCount--;
        drain();
      });
  }
}

async function runFetch(url: string): Promise<string | null> {
  if (isTauriRuntime()) {
    const res = await fetchImageNative(url);
    if (!res) return null;
    const bin = atob(res.base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    await putImageCache(url, bytes.buffer, res.mime);
    return bufferToBlobUrl(url, bytes.buffer, res.mime);
  }
  return url;
}

export function requestCachedImage(
  url: string,
  signal?: AbortSignal
): { immediate: string | null; promise: Promise<string | null> } {
  const cached = peekImageCache(url);
  const immediate = cached
    ? blobUrls.get(url) || bufferToBlobUrl(url, cached.buffer, cached.mime)
    : !isTauriRuntime()
      ? url
      : null;

  if (!isTauriRuntime()) {
    return { immediate: url, promise: Promise.resolve(url) };
  }

  const promise = new Promise<string | null>(resolve => {
    const task: QueueTask = { url, background: Boolean(cached), resolve, cancelled: false };
    if (signal) {
      signal.addEventListener(
        'abort',
        () => {
          task.cancelled = true;
          resolve(immediate);
        },
        { once: true }
      );
    }
    queue.push(task);
    drain();
  });

  return { immediate, promise };
}
