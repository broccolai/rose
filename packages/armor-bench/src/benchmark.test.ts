import { describe, expect, test } from 'bun:test';
import { hasBenchmarkInputs, loadLatestBenchmarkBundle } from './bundle';
import { runComparisonBenchmarks } from './run';
import { defaultBenchmarkScenarios } from './scenarios';

const maybeDescribe = hasBenchmarkInputs() ? describe : describe.skip;

maybeDescribe('D2ArmorPicker comparison benchmarks', () => {
    test('Rose and one-worker D2AP agree on multiple result-returning loaded-vault scenarios', async () => {
        const bundle = loadLatestBenchmarkBundle();
        const results = await runComparisonBenchmarks(bundle, defaultBenchmarkScenarios);

        expect(results).toHaveLength(defaultBenchmarkScenarios.length);

        for (const result of results) {
            expect(result.d2ap.checkedCalculations).toBeGreaterThanOrEqual(result.d2ap.computedPermutations);
            expect(result.rose.resultCount).toBe(result.d2ap.computedPermutations);
            expect(result.rose.returnedBuildCount).toBe(Math.min(result.rose.resultCount, 30_000));
            expect(result.rose.ok).toBe(true);
            expect(result.rose.resultCount).toBeGreaterThan(0);
        }

        expect(results.find((result) => result.scenario.id === 'warlock-tsteps-weapons-200')?.rose.resultCount).toBe(1050);
        expect(results.find((result) => result.scenario.id === 'warlock-tsteps-weapons-100-super-100')?.rose.resultCount).toBe(349203);
        expect(results.find((result) => result.scenario.id === 'warlock-tsteps-super-180-two-piece')?.rose.resultCount).toBe(84);
    }, 30_000);
});
