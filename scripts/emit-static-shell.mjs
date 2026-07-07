import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const publicDir = '.output/public';
const legacyClientDir = 'dist/client';
const indexPath = join(publicDir, 'index.html');
const html = await readFile(indexPath, 'utf8');

await writeFile(join(publicDir, '_redirects'), '/* /index.html 200\n');
await mkdir(join(publicDir, 'auth/bungie/callback'), { recursive: true });
await writeFile(join(publicDir, 'auth/bungie/callback/index.html'), html);

await rm(legacyClientDir, { recursive: true, force: true });
await cp(publicDir, legacyClientDir, { recursive: true });
