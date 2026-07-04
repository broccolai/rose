import { loadLatestBenchmarkBundle } from './bundle';
import { runComparisonBenchmarks } from './run';
import { defaultBenchmarkScenarios } from './scenarios';

const bundle = loadLatestBenchmarkBundle();
const results = await runComparisonBenchmarks(bundle, defaultBenchmarkScenarios);

console.log(`Loaded ${bundle.normalizedProfile?.armor?.length ?? 0} normalized armor items from benchmark bundle.`);

for (const result of results) {
    console.log('');
    console.log(`Scenario: ${result.scenario.name}`);
    console.log(`Items: ${result.itemCount}; raw slot product: ${result.rawSlotProduct.toLocaleString()}`);
    console.log(
        `Rose: ${result.rose.elapsedMs.toFixed(2)}ms; ok=${result.rose.ok}; searched=${result.rose.searchedCombinations.toLocaleString()}; computed=${
            result.rose.resultCount
        }; returned=${result.rose.returnedBuildCount}`
    );
    console.log(
        `D2AP: ${result.d2ap.elapsedMs.toFixed(2)}ms; checked=${result.d2ap.checkedCalculations.toLocaleString()}; computed=${
            result.d2ap.computedPermutations
        }; saved=${result.d2ap.savedResults}; workerReported=${result.d2ap.workerReportedMs}ms`
    );
}
