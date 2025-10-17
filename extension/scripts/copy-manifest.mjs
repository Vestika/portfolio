import { copyFile } from 'node:fs/promises';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const src = resolve(process.cwd(), 'public/manifest.json');
const dest = resolve(process.cwd(), 'dist/manifest.json');
await mkdir(dirname(dest), { recursive: true });
await copyFile(src, dest);
console.log('Copied manifest to dist/manifest.json');

