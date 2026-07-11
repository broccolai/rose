import { basename } from 'node:path';
import { getLatestInteractiveBenchmarkBundlePath, loadLatestInteractiveBenchmarkBundle } from './bundle';
import { interactiveBenchmarkScenarios } from './interactive-scenarios';
import { runInteractiveScenarioBenchmark } from './interactive-suite';
import type { InteractiveBenchmarkResult, MeasuredWorkload, SolveWorkloadResult } from './types';

const iterations = numberFromEnvironment('ROSE_BENCH_ITERATIONS');
const warmupIterations = numberFromEnvironment('ROSE_BENCH_WARMUPS');
const bundle = loadLatestInteractiveBenchmarkBundle();
const bundlePath = getLatestInteractiveBenchmarkBundlePath();
const selectedScenarioIds = new Set(
    (process.env['ROSE_BENCH_SCENARIO'] ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
);
const explicitlySelectedScenarios =
    selectedScenarioIds.size === 0
        ? interactiveBenchmarkScenarios
        : interactiveBenchmarkScenarios.filter((scenario) => selectedScenarioIds.has(scenario.id));
const scenarios =
    process.env['ROSE_BENCH_INCLUDE_STRESS'] === '1' || selectedScenarioIds.size > 0
        ? explicitlySelectedScenarios
        : explicitlySelectedScenarios.filter((scenario) => scenario.benchmarkTier !== 'stress');
const runOptions = { iterations, warmupIterations };

if (process.argv.includes('--json')) {
    const results = scenarios.map((scenario) => runInteractiveScenarioBenchmark(bundle, scenario, runOptions));
    console.log(JSON.stringify(results, null, 2));
} else {
    console.log(`Fixture: ${bundlePath ? basename(bundlePath) : 'unknown'}`);
    console.log(`Loaded ${bundle.normalizedProfile?.armor?.length ?? 0} normalized armor items.`);
    console.log(`Scenarios: ${scenarios.length}; warm samples per operation: ${iterations ?? 1}`);

    for (const scenario of scenarios) {
        console.log(`\nRunning ${scenario.id}...`);
        printScenario(runInteractiveScenarioBenchmark(bundle, scenario, runOptions));
    }
}

function printScenario(result: InteractiveBenchmarkResult): void {
    console.log('');
    console.log(`${result.scenario.id} | ${result.scenario.name}`);
    console.log(
        `items=${result.itemCount} | tunable=${result.tunableItemCount} | slot product=${result.rawSlotProduct.toLocaleString()} | ${filterSummary(
            result
        )}`
    );
    console.log('operation                 cold       warm med   p95');
    console.log(`single slider             ${timingColumns(result.singleSlider)}`);
    console.log(`combined slider caps      ${timingColumns(result.combinedSliders)}`);
    console.log(`UI slider refresh         ${timingColumns(result.uiSliderRefresh)}`);
    console.log(`slider sequence (${result.scenario.sliderSteps.length})      ${timingColumns(result.sliderSequence)}`);
    console.log(`solve total               ${timingColumns(result.solve)}`);
    console.log(`solve first 25            ${firstResultColumns(result.solve)}`);

    const latestSolve = result.solve.warmValues.at(-1) ?? result.solve.coldValue;
    const latestSequence = result.sliderSequence.warmValues.at(-1) ?? result.sliderSequence.coldValue;
    console.log(
        `steps: ${latestSequence.steps
            .map((step) => `${step.stat}=${step.value}${step.clamped ? `->${step.priorityCap}` : ''} ${formatMs(step.elapsedMs)}`)
            .join(' | ')}`
    );
    console.log(
        `result: ok=${latestSolve.ok} returned=${latestSolve.returnedBuildCount} valid=${latestSolve.validBuildCount} searched=${latestSolve.searchedCombinations.toLocaleString()}`
    );
}

function timingColumns(workload: MeasuredWorkload<unknown>): string {
    const hasWarmSamples = workload.warm.samplesMs.length > 0;
    return `${formatMs(workload.coldMs).padStart(9)}  ${formatNullableMs(hasWarmSamples ? workload.warm.medianMs : null).padStart(
        9
    )}  ${formatNullableMs(hasWarmSamples ? workload.warm.p95Ms : null).padStart(9)}`;
}

function firstResultColumns(workload: MeasuredWorkload<SolveWorkloadResult>): string {
    const warmSamples = workload.warmValues
        .map((result) => result.firstResultsMs)
        .filter((value): value is number => value !== null)
        .sort((left, right) => left - right);
    const median = warmSamples[Math.floor(warmSamples.length / 2)] ?? null;
    const p95 = warmSamples[Math.max(0, Math.ceil(warmSamples.length * 0.95) - 1)] ?? null;

    return `${formatNullableMs(workload.coldValue.firstResultsMs).padStart(9)}  ${formatNullableMs(median).padStart(9)}  ${formatNullableMs(p95).padStart(9)}`;
}

function filterSummary(result: InteractiveBenchmarkResult): string {
    const scenario = result.scenario;
    return [
        `class=${scenario.classType}`,
        `exotic=${scenario.selectedExoticItemHash ?? 'none'}`,
        `dump=${scenario.dumpStat ?? 'none'}`,
        `sets=${scenario.setRequirements?.length ?? 0}`,
        `bonuses=${scenario.statBonuses ? 'yes' : 'no'}`,
        `balanced=${scenario.allowBalancedTuning === true ? 'yes' : 'no'}`
    ].join(' ');
}

function formatMs(value: number): string {
    return `${value.toFixed(2)}ms`;
}

function formatNullableMs(value: number | null): string {
    return value === null ? '-' : formatMs(value);
}

function numberFromEnvironment(key: string): number | undefined {
    const raw = process.env[key];
    if (!raw) {
        return undefined;
    }

    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
}
