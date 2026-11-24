import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';
import { sourceAlias } from './shared/paths.mjs';

export default defineConfig({
  resolve: { alias: sourceAlias },
  base: process.env.BASE_PATH || '/',
  clearScreen: false,
  server: {
    watch: { ignored: ['**/src-tauri/**'] },
    proxy: {
      '/api': 'http://127.0.0.1:8080',
    },
  },
  build: {
    ...(process.env.TAURI_ENV_PLATFORM === 'android'
      ? { target: 'chrome91', cssTarget: 'chrome91' }
      : {}),
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('shaka-player')) return 'shaka-player';
          return undefined;
        },
      },
    },
  },
  plugins: [
    preact(),
    {
      name: 'wachcha-pwa',
      apply: 'build',
      async closeBundle() {
        const dir = resolve('dist');
        let assetFiles: string[] = [];
        try {
          assetFiles = (await readdir(resolve(dir, 'assets')))
            .filter(f => !f.includes('shaka-player'))
            .map(f => `assets/${f}`);
        } catch {
          assetFiles = [];
        }
        const files = ['index.html', 'manifest.webmanifest', 'icons/icon.svg', ...assetFiles];
        const hash = createHash('sha256');
        for (const file of files) {
          try {
            hash.update(await readFile(resolve(dir, file)));
          } catch {
            // Optional file absent in minimal builds.
          }
        }
        const version = hash.digest('hex').slice(0, 12);
        const source = await readFile(resolve('src/sw.js'), 'utf8');
        await writeFile(
          resolve(dir, 'sw.js'),
          source.replace('__VERSION__', version).replace('__PRECACHE__', JSON.stringify(files))
        );
      },
    },
  ],
});
