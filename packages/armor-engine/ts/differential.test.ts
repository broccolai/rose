import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { interactiveBenchmarkScenarios } from '../../armor-bench/src/interactive-scenarios';
import { runRustWasmBenchmark } from '../../armor-bench/src/rust-wasm-runner';
import type { LoadedBenchmarkBundle } from '../../armor-bench/src/types';

const privateData = join(process.cwd(), 'data/private');
const fixtures = [
    {
        file: 'rose-debug-vault-export-2026-07-06T00-25-57-760Z.json',
        scenarios: [
            'warlock-open-dump-health',
            'warlock-nezarec-high-targets',
            'warlock-tsteps-seventh-seraph-two-piece',
            'hunter-fortunes-favor-fragments',
            'warlock-seventh-seraph-four-piece',
            'titan-no-dump'
        ]
    },
    {
        file: 'rose-debug-vault-export-2026-07-11T10-56-08-018Z.json',
        scenarios: ['hunter-stompees-health-dump-high-weapons', 'hunter-stompees-health-dump-two-high-stats']
    }
] as const;

describe('Rust/Wasm solver differential fixtures', () => {
    for (const fixture of fixtures) {
        const fixturePath = join(privateData, fixture.file);
        const fixtureTest = existsSync(fixturePath) ? test : test.skip;
        fixtureTest(
            fixture.file,
            () => {
                const bundle = JSON.parse(readFileSync(fixturePath, 'utf8')) as LoadedBenchmarkBundle;
                for (const scenarioId of fixture.scenarios) {
                    const scenario = interactiveBenchmarkScenarios.find((candidate) => candidate.id === scenarioId);
                    expect(scenario, `Missing benchmark scenario ${scenarioId}`).toBeDefined();
                    if (!scenario) {
                        continue;
                    }
                    const result = runRustWasmBenchmark(bundle, scenario, 1);
                    expect(result.capParity, `${scenario.name} caps`).toBe(true);
                    expect(result.solveParity, `${scenario.name} solve`).toBe(true);
                }
            },
            30_000
        );
    }
});
