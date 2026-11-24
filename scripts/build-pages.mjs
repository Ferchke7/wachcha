import { spawnSync } from 'node:child_process';
import { copyFile, cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const pagesDir = resolve('pages-dist');
const appBase = process.env.PAGES_APP_BASE || '/wachcha/app/';

await rm(pagesDir, { recursive: true, force: true });
await mkdir(resolve(pagesDir, 'icons'), { recursive: true });

const build = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build:web'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: {
    ...process.env,
    BASE_PATH: appBase,
  },
});

if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

await cp(resolve('site'), pagesDir, { recursive: true });
await cp(resolve('dist'), resolve(pagesDir, 'app'), { recursive: true });
await copyFile(resolve('public/icons/icon.svg'), resolve(pagesDir, 'icons/icon.svg'));
await copyFile(resolve('src-tauri/icons/128x128@2x.png'), resolve(pagesDir, 'icons/icon-256.png'));
await writeFile(resolve(pagesDir, '.nojekyll'), '');

console.log(`GitHub Pages bundle ready at ${pagesDir} (Web App base: ${appBase})`);
