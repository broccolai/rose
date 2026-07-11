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

export function loadLatestInteractiveBenchmarkBundle() {
    const bundlePath = getLatestInteractiveBenchmarkBundlePath();

    if (!bundlePath) {
        throw new Error(`No compatible benchmark or debug export found in ${privateDataDir}.`);
    }

    return JSON.parse(readFileSync(bundlePath, 'utf8')) as LoadedBenchmarkBundle;
}

export function getLatestInteractiveBenchmarkBundlePath() {
    return findLatestInteractiveBenchmarkBundlePath();
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

function findLatestInteractiveBenchmarkBundlePath() {
    if (!existsSync(privateDataDir)) {
        return null;
    }

    const file = readdirSync(privateDataDir)
        .filter(
            (candidate) =>
                (candidate.startsWith('rose-loaded-benchmark-bundle-') || candidate.startsWith('rose-debug-vault-export-')) &&
                candidate.endsWith('.json')
        )
        .sort((left, right) => exportTimestamp(left).localeCompare(exportTimestamp(right)))
        .at(-1);

    return file ? join(privateDataDir, file) : null;
}

function exportTimestamp(fileName: string) {
    return fileName.match(/20\d{2}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z/)?.[0] ?? fileName;
}
