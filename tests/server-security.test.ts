import { describe, expect, it } from 'vitest';
import { isHostAllowed, rewriteHlsManifest } from '../server/index.mjs';

describe('Wachcha server security allowlist & HLS rewriter', () => {
  it('blocks non-HTTPS, IP literals, localhost, and arbitrary domains', () => {
    const allowed = ['libria.fun', 'rutube.ru', 'rtbcdn.ru'];
    expect(isHostAllowed('https://cache.libria.fun/video/1080.m3u8', allowed)).toBe(true);
    expect(isHostAllowed('https://bl.rutube.ru/route/abc.m3u8', allowed)).toBe(true);
    expect(isHostAllowed('http://cache.libria.fun/video/1080.m3u8', allowed)).toBe(false);
    expect(isHostAllowed('https://127.0.0.1/secret', allowed)).toBe(false);
    expect(isHostAllowed('https://169.254.169.254/latest/meta-data', allowed)).toBe(false);
    expect(isHostAllowed('https://localhost/admin', allowed)).toBe(false);
    expect(isHostAllowed('https://evil.example.com/libria.fun.m3u8', allowed)).toBe(false);
  });

  it('rewrites relative HLS segments and AES key URIs through /api/hls', () => {
    const manifest = [
      '#EXTM3U',
      '#EXT-X-KEY:METHOD=AES-128,URI="key.bin"',
      '#EXTINF:6.0,',
      'seg-001.ts',
    ].join('\n');

    const rewritten = rewriteHlsManifest(
      manifest,
      'https://cache.libria.fun/videos/media/ts/9839/1/1080/index.m3u8'
    );
    expect(rewritten).toContain(
      '/api/hls?url=https%3A%2F%2Fcache.libria.fun%2Fvideos%2Fmedia%2Fts%2F9839%2F1%2F1080%2Fkey.bin'
    );
    expect(rewritten).toContain(
      '/api/hls?url=https%3A%2F%2Fcache.libria.fun%2Fvideos%2Fmedia%2Fts%2F9839%2F1%2F1080%2Fseg-001.ts'
    );
  });
});
