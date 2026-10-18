/**
 * Copies Apple emoji images from emoji-datasource-apple into the public directory.
 * Used as a pre-step for both `dev` (Turbopack) and `build` (webpack) so that
 * neither pipeline needs a webpack CopyPlugin for this purpose.
 */
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  readdirSync,
  rmSync,
} from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const src = resolve(
  __dirname,
  '../../../node_modules/emoji-datasource-apple/img/apple/64',
);
const dest = resolve(__dirname, '../public/assets/fonts/emoji');

// File by file, replacing what is already there: on some bind mounts (Docker
// Desktop on macOS) a copy made read-only by an earlier run cannot be overwritten,
// but it can be removed, and the copy is made writable.
mkdirSync(dest, { recursive: true });
for (const name of readdirSync(src)) {
  const target = join(dest, name);
  rmSync(target, { force: true });
  copyFileSync(join(src, name), target);
  chmodSync(target, 0o644);
}

console.log('✔ Emoji assets copied to public/assets/fonts/emoji');
