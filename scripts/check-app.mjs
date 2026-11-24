/**
 * Verifies the production web bundle (`dist/`) + PWA service worker + Rust `media_probe` stdio bridge.
 */
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const required = ['dist/index.html', 'dist/sw.js', 'dist/manifest.webmanifest'];
for (const rel of required) {
  const full = resolve(rel);
  if (!existsSync(full) || statSync(full).size === 0) {
    console.error(`Missing or empty build artifact: ${rel}`);
    process.exit(1);
  }
}

console.log('Production dist/ and PWA service worker verified.');

const probe = spawnSync('node', ['scripts/check-probe.mjs'], { stdio: 'inherit' });
process.exit(probe.status ?? 1);
