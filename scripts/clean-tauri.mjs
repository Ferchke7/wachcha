import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

const dryRun = process.argv.includes('--dry-run');
const targets = ['dist'];

for (const rel of targets) {
  const full = resolve(rel);
  if (dryRun) {
    console.log(`[dry-run] would clean: ${full}`);
  } else {
    rmSync(full, { recursive: true, force: true });
  }
}
