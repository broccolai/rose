import { performance } from 'node:perf_hooks';
import type { ArmorStatTargetCapsInput, SolveArmorResult, StatVector } from '../../armor-domain/src';
import { prepareScenario } from './armor';
import type { InteractiveBenchmarkScenario, LoadedBenchmarkBundle, TimingDistribution } from './types';
import { BenchmarkArmorEngine } from './wasm-engine';

export interface RustWasmBenchmarkResult {
    scenario: InteractiveBenchmarkScenario;
    itemCount: number;
    rawSlotProduct: number;
    initializationMs: number;
    compactProfileBytes: number;
    requestBytes: number;
    wasmMemoryMiB: number;
    caps: TimingDistribution;
    solve: TimingDistribution;
    capResult: StatVector;
    solveResult: { ok: boolean; validBuildCount: number; firstStats?: StatVector | undefined };
}

export const runRustWasmBenchmark = (
    bundle: LoadedBenchmarkBundle,
    scenario: InteractiveBenchmarkScenario,
    iterations = 5
): RustWasmBenchmarkResult => {
    const prepared = prepareScenario(bundle, scenario);
    const input = createInput(prepared.armorBySlot, scenario);
    const solveInput = {
        ...input,
        maxResults: scenario.maxResults ?? 5_000,
        stopWhenResultLimitReached: true
    };
    const engine = new BenchmarkArmorEngine(prepared.armorBySlot);

    try {
        const capResult = engine.calculateCaps(input);
        const solveResult = engine.solve(solveInput);

        engine.calculateCaps(input);
        engine.solve(solveInput);

        const capSamples = measure(iterations, () => engine.calculateCaps(input));
        const solveSamples = measure(iterations, () => engine.solve(solveInput));

        return {
            scenario,
            itemCount: prepared.selectedArmor.length,
            rawSlotProduct: prepared.rawSlotProduct,
            initializationMs: engine.measurements.initializationMs,
            compactProfileBytes: engine.measurements.compactProfileBytes,
            requestBytes: engine.requestBytes(input),
            wasmMemoryMiB: engine.wasmMemoryMiB,
            caps: summarize(capSamples),
            solve: summarize(solveSamples),
            capResult,
            solveResult: solveSummary(solveResult)
        };
    } finally {
        engine.dispose();
    }
};

const createInput = (armor: ArmorStatTargetCapsInput['armor'], scenario: InteractiveBenchmarkScenario): ArmorStatTargetCapsInput => ({
    characterId: scenario.classType,
    classType: scenario.classType,
    selectedExoticItemHash: scenario.selectedExoticItemHash,
    dumpStat: scenario.dumpStat,
    allowBalancedTuning: scenario.allowBalancedTuning,
    statTargets: scenario.targets,
    statBonuses: scenario.statBonuses,
    setRequirements: scenario.setRequirements ?? [],
    armor
});

const measure = (iterations: number, run: () => unknown): number[] => {
    const samples = [];
    for (let index = 0; index < iterations; index++) {
        const startedAt = performance.now();
        run();
        samples.push(performance.now() - startedAt);
    }
    return samples;
};

const summarize = (samplesMs: number[]): TimingDistribution => {
    const sorted = [...samplesMs].sort((left, right) => left - right);
    const percentile = (value: number): number =>
        sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * value) - 1))] ?? 0;
    return {
        samplesMs,
        minMs: sorted[0] ?? 0,
        medianMs: percentile(0.5),
        meanMs: sorted.reduce((sum, value) => sum + value, 0) / Math.max(1, sorted.length),
        p95Ms: percentile(0.95),
        maxMs: sorted.at(-1) ?? 0
    };
};

const solveSummary = (result: SolveArmorResult): RustWasmBenchmarkResult['solveResult'] => ({
    ok: result.ok,
    validBuildCount: result.validBuildCount,
    firstStats: result.ok ? result.builds[0]?.stats : undefined
});
