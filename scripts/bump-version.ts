import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const VERSION_FILE = resolve(import.meta.dir, '../src/app-version.ts');
const VERSION_PATTERN = /APP_VERSION\s*=\s*'1\.(\d+)'/;

const source = readFileSync(VERSION_FILE, 'utf8');
const match = source.match(VERSION_PATTERN);

if (!match) {
    throw new Error(`Could not find APP_VERSION = '1.x' in ${VERSION_FILE}`);
}

const nextPatch = Number(match[1]) + 1;
const nextSource = source.replace(VERSION_PATTERN, `APP_VERSION = '1.${nextPatch}'`);

writeFileSync(VERSION_FILE, nextSource);
console.log(`rose/ARMOR version bumped to 1.${nextPatch}`);
