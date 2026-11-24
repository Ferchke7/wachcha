/**
 * Zero-port stdio verification script exercising the compiled Rust `media_probe` binary.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ext = process.platform === 'win32' ? '.exe' : '';
const bin = resolve(`src-tauri/target/debug/examples/media_probe${ext}`);

if (!existsSync(bin)) {
  console.error(`media_probe binary not found at ${bin}. Build it first.`);
  process.exit(1);
}

const proc = spawn(bin, [], { stdio: ['pipe', 'pipe', 'inherit'] });

const requests = [
  { id: 1, action: 'providers' },
  {
    id: 2,
    action: 'resolve',
    candidates: [
      {
        provider: 'aniliberty',
        mediaId: 'frieren',
        episodeId: 'ep1',
        voiceLabel: 'AniLibria',
        quality: '1080p',
        format: 'hls',
        url: 'https://cache.aniliberty.top/1080.m3u8',
        preferred: true,
        headers: [],
        allowedHosts: [],
        skips: [],
        subtitles: [],
      },
      {
        provider: 'rutube',
        mediaId: 'frieren',
        episodeId: 'ep1',
        voiceLabel: 'Rutube',
        quality: '720p',
        format: 'hls',
        url: 'https://edge.rtbcdn.ru/720.m3u8',
        preferred: false,
        headers: [['Referer', 'https://rutube.ru/']],
        allowedHosts: ['*.rtbcdn.ru'],
        skips: [],
        subtitles: [],
      },
    ],
  },
  { id: 3, action: 'media', uri: 'wachcha-media://localhost/bad/invalid/path' },
];

let buffer = '';
const responses = [];

proc.stdout.on('data', chunk => {
  buffer += chunk.toString('utf8');
  let nl;
  while ((nl = buffer.indexOf('\n')) !== -1) {
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (line) responses.push(JSON.parse(line));
  }
});

for (const req of requests) {
  proc.stdin.write(`${JSON.stringify(req)}\n`);
}
proc.stdin.end();

proc.on('close', code => {
  if (code !== 0 || responses.length !== requests.length) {
    console.error('media_probe failed:', { code, count: responses.length });
    process.exit(1);
  }
  const [r1, r2, r3] = responses;
  if (!Array.isArray(r1.result) || r1.result.length < 7) {
    console.error('Expected >=7 built-in providers, got:', r1);
    process.exit(1);
  }
  if (!r2.result?.streams?.[1]?.url?.startsWith('wachcha-media://localhost/rutube/')) {
    console.error('Expected opaque wachcha-media relay URI, got:', r2);
    process.exit(1);
  }
  if (r3.result?.status !== 400) {
    console.error('Expected HTTP 400 for invalid media path, got:', r3);
    process.exit(1);
  }
  console.log(
    `media_probe OK: ${r1.result.length} providers, staggered resolver & wachcha-media:// guard verified (zero TCP ports).`
  );
});
