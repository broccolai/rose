import { prepareScenario } from './armor';
import { createD2APBenchmarkAdapter } from './d2ap-adapter';
import { runRoseScenario } from './rose-runner';
import type { BenchmarkScenario, ComparisonBenchmarkResult, LoadedBenchmarkBundle } from './types';

export async function runComparisonBenchmarks(bundle: LoadedBenchmarkBundle, scenarios: BenchmarkScenario[]) {
    const d2ap = createD2APBenchmarkAdapter();
    const results: ComparisonBenchmarkResult[] = [];

    for (const scenario of scenarios) {
        const prepared = prepareScenario(bundle, scenario);
        const rose = runRoseScenario(prepared);
        const d2apResult = await d2ap.runScenario(prepared.selectedArmor, scenario);

        results.push({
            scenario,
            itemCount: prepared.selectedArmor.length,
            rawSlotProduct: prepared.rawSlotProduct,
            rose,
            d2ap: d2apResult
        });
    }

    return results;
}
