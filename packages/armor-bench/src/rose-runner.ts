import { performance } from 'node:perf_hooks';
import type { PreparedScenario, SolverBenchmarkResult } from './types';
import { BenchmarkArmorEngine } from './wasm-engine';

export const runRoseScenario = (prepared: PreparedScenario): SolverBenchmarkResult => {
    const engine = new BenchmarkArmorEngine(prepared.armorBySlot);

    try {
        const start = performance.now();
        const result = engine.solve({
            characterId: prepared.scenario.classType,
            classType: prepared.scenario.classType,
            selectedExoticItemHash: prepared.scenario.selectedExoticItemHash,
            dumpStat: prepared.scenario.dumpStat,
            allowBalancedTuning: prepared.scenario.allowBalancedTuning,
            statTargets: prepared.scenario.targets,
            statBonuses: prepared.scenario.statBonuses,
            setRequirements: prepared.scenario.setRequirements ?? [],
            armor: prepared.armorBySlot,
            maxResults: prepared.scenario.maxResults ?? 30_000
        });

        return {
            ok: result.ok,
            elapsedMs: performance.now() - start,
            searchedCombinations: result.searchedCombinations,
            returnedBuildCount: result.returnedBuildCount,
            resultCount: result.validBuildCount
        };
    } finally {
        engine.dispose();
    }
};
