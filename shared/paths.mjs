import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

export const sourceAlias = {
  '~': resolve(root, 'src'),
};
