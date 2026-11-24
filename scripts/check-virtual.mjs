/**
 * Verifies VirtualGrid renders a bounded window for 10,000 items via Vitest.
 */
import { spawnSync } from 'node:child_process';

const res = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['vitest', 'run', 'tests/ui-components.ui.test.tsx'],
  {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  }
);
process.exit(res.status ?? 1);
