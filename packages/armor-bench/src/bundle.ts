import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { LoadedBenchmarkBundle } from './types';

export const privateDataDir = join(process.cwd(), 'data/private');
export const d2apSourceMapPath = '/private/tmp/d2armorpicker-main.js.map';

export function hasBenchmarkInputs() {
    return findLatestBenchmarkBundlePath() !== null && existsSync(d2apSourceMapPath);
}

export function loadLatestBenchmarkBundle() {
    const bundlePath = findLatestBenchmarkBundlePath();

    if (!bundlePath) {
        throw new Error(`No loaded benchmark bundle found in ${privateDataDir}.`);
    }

    return JSON.parse(readFileSync(bundlePath, 'utf8')) as LoadedBenchmarkBundle;
}

function findLatestBenchmarkBundlePath() {
    if (!existsSync(privateDataDir)) {
        return null;
    }

    const file = readdirSync(privateDataDir)
        .filter((candidate) => candidate.startsWith('rose-loaded-benchmark-bundle-') && candidate.endsWith('.json'))
        .sort()
        .at(-1);

    return file ? join(privateDataDir, file) : null;
}
