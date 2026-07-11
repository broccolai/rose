import type { StatVector } from '@armor-calc';

export type EngineStats = [number, number, number, number, number, number];

export interface EngineAdjustmentInput {
    sourceIndex: number;
    deltas: EngineStats;
}

export interface EngineItemInput {
    sourceIndex: number;
    stableId: string;
    itemHash: number;
    slot: number;
    classType: number;
    isExotic: boolean;
    setId: number | null;
    baseStats: EngineStats;
    statMods: EngineAdjustmentInput[];
    tunings: EngineAdjustmentInput[];
}

export interface EngineProfileInput {
    items: EngineItemInput[];
}

export interface EngineSetRequirement {
    setId: number;
    requiredPieces: number;
}

export interface EngineRequest {
    classType: number;
    selectedExoticItemHash: number | null;
    dumpStat: number | null;
    allowBalancedTuning: boolean;
    targets: EngineStats;
    statBonuses: EngineStats;
    setRequirements: EngineSetRequirement[];
}

export interface EngineCapRequest extends EngineRequest {
    requestedStats: number[];
}

export interface EngineSolveRequest extends EngineRequest {
    maxResults: number;
    resultSort: { key: number; descending: boolean } | null;
    stopWhenResultLimitReached: boolean;
}

export interface EngineBuildOutput {
    itemIndices: [number, number, number, number, number];
    statModIndices: [number, number, number, number, number];
    tuningIndices: [number, number, number, number, number];
    stats: EngineStats;
    wastedStats: number;
    totalStats: number;
}

export interface EngineSolveOutput {
    ok: boolean;
    reason: string | null;
    builds: EngineBuildOutput[];
    validBuildCount: number;
    returnedBuildCount: number;
    resultLimitReached: boolean;
    searchedCombinations: number;
    rejectedCombinations: number;
    warnings: string[];
}

export interface EngineCapOutput {
    caps: EngineStats;
    searchedCombinations: number;
    rejectedCombinations: number;
}

export interface EngineProfileSummary {
    itemCount: number;
    slotCounts: [number, number, number, number, number];
    warnings: string[];
}

export interface MaterializedCaps {
    caps: StatVector;
    searchedCombinations: number;
    rejectedCombinations: number;
}
