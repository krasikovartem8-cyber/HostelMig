import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const rel of [
  ['frontend', 'build'],
  ['frontend', 'coverage'],
  ['frontend', 'node_modules', '.cache'],
]) {
  const dir = path.join(root, ...rel);
  try {
    fs.rmSync(dir, { recursive: true, force: true });
    console.log('removed', rel.join('/'));
  } catch (_) {}
}
