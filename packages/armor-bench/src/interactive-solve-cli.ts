import { performance } from 'node:perf_hooks';
import { solveArmor } from '../../armor-calc/src';
import { prepareScenario } from './armor';
import { loadLatestBenchmarkBundle } from './bundle';
import { defaultBenchmarkScenarios } from './scenarios';

const bundle = loadLatestBenchmarkBundle();

for (const scenario of defaultBenchmarkScenarios) {
    const prepared = prepareScenario(bundle, scenario);
    const input = {
        characterId: scenario.classType,
        classType: scenario.classType,
        selectedExoticItemHash: scenario.selectedExoticItemHash,
        statTargets: scenario.targets,
        setRequirements: scenario.setRequirements ?? [],
        armor: prepared.armorBySlot,
        maxResults: 5_000
    } as const;
    const startedAt = performance.now();
    const result = solveArmor({
        ...input,
        stopWhenResultLimitReached: true
    });
    const elapsedMs = performance.now() - startedAt;

    console.log(
        [
            scenario.id,
            `${elapsedMs.toFixed(2)}ms`,
            `ok=${result.ok}`,
            `returned=${result.returnedBuildCount}`,
            `valid=${result.validBuildCount}`,
            `searched=${result.searchedCombinations}`
        ].join(' | ')
    );

    if (process.env['ROSE_COMPARE_EXACT_SOLVE'] === '1') {
        const exactStartedAt = performance.now();
        const exactResult = solveArmor(input);
        const exactElapsedMs = performance.now() - exactStartedAt;

        console.log(
            [
                `${scenario.id}:exact`,
                `${exactElapsedMs.toFixed(2)}ms`,
                `ok=${exactResult.ok}`,
                `returned=${exactResult.returnedBuildCount}`,
                `valid=${exactResult.validBuildCount}`,
                `searched=${exactResult.searchedCombinations}`
            ].join(' | ')
        );
    }
}
