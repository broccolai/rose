import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { initSync, WasmArmorEngine } from '../../../src/features/armor/wasm/generated/rose_armor_wasm.js';
import {
    ARMOR_STATS,
    type ArmorStatTargetCapsInput,
    calculateArmorStatTargetCaps,
    type StatVector,
    solveArmor
} from '../../armor-calc/src';
import { ArmorEngineAdapter } from '../../armor-engine/ts';
import { prepareScenario } from './armor';
import type { InteractiveBenchmarkScenario, LoadedBenchmarkBundle, TimingDistribution } from './types';

const wasmPath = fileURLToPath(new URL('../../../src/features/armor/wasm/generated/rose_armor_wasm_bg.wasm', import.meta.url));
let wasmInitialized = false;
let wasmMemory: WebAssembly.Memory | null = null;

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
    capParity: boolean;
    solveParity: boolean;
    rustCaps: StatVector;
    typescriptCaps: StatVector;
    rustSolve: { ok: boolean; validBuildCount: number; firstStats?: StatVector | undefined };
    typescriptSolve: { ok: boolean; validBuildCount: number; firstStats?: StatVector | undefined };
}

export const runRustWasmBenchmark = (
    bundle: LoadedBenchmarkBundle,
    scenario: InteractiveBenchmarkScenario,
    iterations = 5
): RustWasmBenchmarkResult => {
    initializeWasm();
    const prepared = prepareScenario(bundle, scenario);
    const input = createInput(prepared.armorBySlot, scenario);
    const adapter = new ArmorEngineAdapter(prepared.armorBySlot);
    const initializationStartedAt = performance.now();
    const engine = new WasmArmorEngine(adapter.profile);
    const initializationMs = performance.now() - initializationStartedAt;

    const typescriptCaps = calculateArmorStatTargetCaps(input);
    const rustCaps = adapter.materializeCaps(engine.calculate_caps(adapter.createCapRequest(input, ARMOR_STATS))).caps;
    const typescriptSolve = solveArmor({ ...input, maxResults: scenario.maxResults ?? 5_000, stopWhenResultLimitReached: true });
    const rustSolve = adapter.materializeSolve(
        engine.solve(adapter.createSolveRequest({ ...input, maxResults: scenario.maxResults ?? 5_000, stopWhenResultLimitReached: true }))
    );

    engine.calculate_caps(adapter.createCapRequest(input, ARMOR_STATS));
    engine.solve(adapter.createSolveRequest({ ...input, maxResults: scenario.maxResults ?? 5_000, stopWhenResultLimitReached: true }));
    const capSamples = measure(iterations, () => engine.calculate_caps(adapter.createCapRequest(input, ARMOR_STATS)));
    const solveSamples = measure(iterations, () =>
        engine.solve(adapter.createSolveRequest({ ...input, maxResults: scenario.maxResults ?? 5_000, stopWhenResultLimitReached: true }))
    );
    engine.free();

    return {
        scenario,
        itemCount: prepared.selectedArmor.length,
        rawSlotProduct: prepared.rawSlotProduct,
        initializationMs,
        compactProfileBytes: JSON.stringify(adapter.profile).length,
        requestBytes: JSON.stringify(adapter.createCapRequest(input, ARMOR_STATS)).length,
        wasmMemoryMiB: (wasmMemory?.buffer.byteLength ?? 0) / (1024 * 1024),
        caps: summarize(capSamples),
        solve: summarize(solveSamples),
        capParity: ARMOR_STATS.every((stat) => rustCaps[stat] === typescriptCaps[stat]),
        solveParity:
            rustSolve.ok === typescriptSolve.ok &&
            (!rustSolve.ok || !typescriptSolve.ok || rustSolve.validBuildCount === typescriptSolve.validBuildCount),
        rustCaps,
        typescriptCaps,
        rustSolve: solveSummary(rustSolve),
        typescriptSolve: solveSummary(typescriptSolve)
    };
};

const initializeWasm = (): void => {
    if (wasmInitialized) {
        return;
    }
    wasmMemory = initSync({ module: readFileSync(wasmPath) }).memory;
    wasmInitialized = true;
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

const solveSummary = (result: ReturnType<typeof solveArmor>): RustWasmBenchmarkResult['rustSolve'] => ({
    ok: result.ok,
    validBuildCount: result.validBuildCount,
    firstStats: result.ok ? result.builds[0]?.stats : undefined
});
