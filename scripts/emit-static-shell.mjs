import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const clientDir = 'dist/client';
const manifestPath = join(clientDir, '.vite/manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const entry = manifest['src/entry-client.tsx'];

if (!entry?.file) {
    throw new Error('Missing src/entry-client.tsx in Vite client manifest.');
}

const cssLinks = (entry.css ?? [])
    .map((href) => `        <link rel="stylesheet" href="/${href}">`)
    .join('\n');
const modulePreloads = (entry.imports ?? [])
    .map((importKey) => manifest[importKey]?.file)
    .filter(Boolean)
    .map((href) => `        <link rel="modulepreload" href="/${href}">`)
    .join('\n');

const html = `<!doctype html>
<html lang="en">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>rose/ARMOR</title>
${modulePreloads}
${cssLinks}
    </head>
    <body>
        <div id="app"></div>
        <script type="module" src="/${entry.file}"></script>
    </body>
</html>
`;

await writeFile(join(clientDir, 'index.html'), html);
await writeFile(join(clientDir, '_redirects'), '/* /index.html 200\n');
await mkdir(dirname(join(clientDir, 'auth/bungie/callback/index.html')), { recursive: true });
await writeFile(join(clientDir, 'auth/bungie/callback/index.html'), html);
