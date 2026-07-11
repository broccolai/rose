import { performance } from 'node:perf_hooks';
import {
    ARMOR_STATS,
    type ArmorStat,
    type ArmorStatTargetCapsInput,
    calculateArmorStatTargetCap,
    calculateArmorStatTargetCaps,
    type SolveArmorInput,
    type StatVector,
    solveArmor
} from '../../armor-calc/src';
import { prepareScenario } from './armor';
import type {
    BenchmarkRunOptions,
    InteractiveBenchmarkResult,
    InteractiveBenchmarkScenario,
    LoadedBenchmarkBundle,
    MeasuredWorkload,
    PreparedScenario,
    SliderRefreshResult,
    SliderSequenceResult,
    SolveWorkloadResult,
    TimingDistribution
} from './types';

const DEFAULT_ITERATIONS = 1;
const DEFAULT_WARMUP_ITERATIONS = 0;
const FIRST_RESULT_COUNT = 25;

type NormalizedBenchmarkRunOptions = {
    iterations: number;
    warmupIterations: number;
};

export function runInteractiveBenchmarkSuite(
    bundle: LoadedBenchmarkBundle,
    scenarios: readonly InteractiveBenchmarkScenario[],
    options: BenchmarkRunOptions = {}
): InteractiveBenchmarkResult[] {
    const benchmarkOptions = normalizeRunOptions(options);

    return scenarios.map((scenario) => runInteractiveScenarioBenchmark(bundle, scenario, benchmarkOptions));
}

export function runInteractiveScenarioBenchmark(
    bundle: LoadedBenchmarkBundle,
    scenario: InteractiveBenchmarkScenario,
    options: BenchmarkRunOptions = {}
): InteractiveBenchmarkResult {
    const benchmarkOptions = normalizeRunOptions(options);
    const prepared = prepareScenario(bundle, scenario);

    return {
        scenario,
        itemCount: prepared.selectedArmor.length,
        rawSlotProduct: prepared.rawSlotProduct,
        tunableItemCount: prepared.tunableItemCount,
        singleSlider: measurePreparedWorkload(bundle, scenario, benchmarkOptions, (input) =>
            calculateArmorStatTargetCap(input, scenario.priorityStat)
        ),
        combinedSliders: measurePreparedWorkload(bundle, scenario, benchmarkOptions, (input) => calculateArmorStatTargetCaps(input)),
        uiSliderRefresh: measurePreparedWorkload(bundle, scenario, benchmarkOptions, (input) =>
            runUiSliderRefresh(input, scenario.priorityStat)
        ),
        sliderSequence: measurePreparedWorkload(bundle, scenario, { ...benchmarkOptions, iterations: 0, warmupIterations: 0 }, (input) =>
            runSliderSequence(input, scenario)
        ),
        solve: measurePreparedWorkload(bundle, scenario, benchmarkOptions, (input) => runInteractiveSolve(input, scenario))
    };
}

function measurePreparedWorkload<T>(
    bundle: LoadedBenchmarkBundle,
    scenario: InteractiveBenchmarkScenario,
    options: NormalizedBenchmarkRunOptions,
    run: (input: ArmorStatTargetCapsInput, prepared: PreparedScenario) => T
): MeasuredWorkload<T> {
    const prepared = prepareScenario(bundle, scenario);
    const input = createCapsInput(prepared);
    const coldStartedAt = performance.now();
    const coldValue = run(input, prepared);
    const coldMs = performance.now() - coldStartedAt;

    for (let index = 0; index < options.warmupIterations; index++) {
        run(input, prepared);
    }

    const samplesMs: number[] = [];
    const warmValues: T[] = [];
    for (let index = 0; index < options.iterations; index++) {
        const startedAt = performance.now();
        warmValues.push(run(input, prepared));
        samplesMs.push(performance.now() - startedAt);
    }

    return {
        coldMs,
        coldValue,
        warm: summarizeTimings(samplesMs),
        warmValues
    };
}

function createCapsInput(prepared: PreparedScenario, targets: Partial<StatVector> = prepared.scenario.targets): ArmorStatTargetCapsInput {
    return {
        characterId: prepared.scenario.classType,
        classType: prepared.scenario.classType,
        selectedExoticItemHash: prepared.scenario.selectedExoticItemHash,
        dumpStat: prepared.scenario.dumpStat,
        allowBalancedTuning: prepared.scenario.allowBalancedTuning,
        statTargets: targets,
        statBonuses: prepared.scenario.statBonuses,
        setRequirements: prepared.scenario.setRequirements ?? [],
        armor: prepared.armorBySlot
    };
}

function runUiSliderRefresh(input: ArmorStatTargetCapsInput, priorityStat: ArmorStat): SliderRefreshResult {
    const priorityCap = calculateArmorStatTargetCap(input, priorityStat);
    const caps = emptyStats();
    caps[priorityStat] = priorityCap;
    const requestedTarget = input.statTargets[priorityStat] ?? 0;
    if (requestedTarget > priorityCap) {
        return { priorityCap, caps, clamped: true };
    }

    const remainingStats = ARMOR_STATS.filter((stat) => stat !== priorityStat);
    const remainingCaps = calculateArmorStatTargetCaps(input, remainingStats);
    for (const stat of remainingStats) {
        caps[stat] = remainingCaps[stat];
    }

    return { priorityCap, caps, clamped: false };
}

function runSliderSequence(input: ArmorStatTargetCapsInput, scenario: InteractiveBenchmarkScenario): SliderSequenceResult {
    const baseTargets = {
        ...emptyStats(),
        ...input.statTargets,
        [scenario.priorityStat]: 0
    };
    let targets = { ...baseTargets };
    const steps: SliderSequenceResult['steps'] = [];

    for (const step of scenario.sliderSteps) {
        const stepTargets = scenario.sliderStepMode === 'independent' ? { ...baseTargets } : { ...targets };
        stepTargets[step.stat] = step.value;
        const stepInput = { ...input, statTargets: stepTargets };
        const startedAt = performance.now();
        const refresh = runUiSliderRefresh(stepInput, step.stat);
        const elapsedMs = performance.now() - startedAt;
        if (refresh.clamped) {
            stepTargets[step.stat] = refresh.priorityCap;
        }
        targets = stepTargets;
        steps.push({ ...step, ...refresh, elapsedMs });
    }

    return { steps, finalTargets: targets };
}

function runInteractiveSolve(input: ArmorStatTargetCapsInput, scenario: InteractiveBenchmarkScenario): SolveWorkloadResult {
    const startedAt = performance.now();
    let firstResultsMs: number | null = null;
    const result = solveArmor(
        {
            ...input,
            maxResults: scenario.maxResults ?? 5_000,
            stopWhenResultLimitReached: true
        } satisfies SolveArmorInput,
        {
            progressBuildCount: FIRST_RESULT_COUNT,
            onProgress: () => {
                firstResultsMs ??= performance.now() - startedAt;
            }
        }
    );

    if (firstResultsMs === null && result.ok && result.returnedBuildCount > 0) {
        firstResultsMs = performance.now() - startedAt;
    }

    return {
        ok: result.ok,
        firstResultsMs,
        searchedCombinations: result.searchedCombinations,
        returnedBuildCount: result.returnedBuildCount,
        validBuildCount: result.validBuildCount
    };
}

function summarizeTimings(samplesMs: number[]): TimingDistribution {
    const sorted = [...samplesMs].sort((left, right) => left - right);
    const total = sorted.reduce((sum, sample) => sum + sample, 0);

    return {
        samplesMs,
        minMs: sorted[0] ?? 0,
        medianMs: percentile(sorted, 0.5),
        meanMs: sorted.length > 0 ? total / sorted.length : 0,
        p95Ms: percentile(sorted, 0.95),
        maxMs: sorted.at(-1) ?? 0
    };
}

function percentile(sorted: readonly number[], percentileValue: number): number {
    if (sorted.length === 0) {
        return 0;
    }

    return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * percentileValue) - 1))];
}

function normalizeRunOptions(options: BenchmarkRunOptions = {}): NormalizedBenchmarkRunOptions {
    return {
        iterations: positiveInteger(options.iterations, DEFAULT_ITERATIONS),
        warmupIterations: nonNegativeInteger(options.warmupIterations, DEFAULT_WARMUP_ITERATIONS)
    };
}

function positiveInteger(value: number | undefined, fallback: number): number {
    return Number.isInteger(value) && Number(value) > 0 ? Number(value) : fallback;
}

function nonNegativeInteger(value: number | undefined, fallback: number): number {
    return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : fallback;
}

function emptyStats(): StatVector {
    return {
        health: 0,
        melee: 0,
        grenade: 0,
        super: 0,
        class: 0,
        weapons: 0
    };
}
