import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dllPath = resolve('src-tauri/native-libs/windows/libmpv-2.dll');

if (existsSync(dllPath)) {
  const hash = createHash('sha256').update(readFileSync(dllPath)).digest('hex');
  console.log(`Found bundled Windows libmpv-2.dll (sha256: ${hash})`);
  process.exit(0);
}

console.log(
  'No local src-tauri/native-libs/windows/libmpv-2.dll found — Wachcha will gracefully fall back to Shaka Player 5.'
);
console.log(
  'To enable native libmpv decoding on Windows, place a verified LGPL libmpv-2.dll in src-tauri/native-libs/windows/ or set WACHCHA_LIBMPV.'
);
