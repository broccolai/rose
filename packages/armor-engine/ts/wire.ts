import { ARMOR_STATS, type StatAdjustment, type StatVector } from '@armor-domain';

import type { EngineAdjustmentInput, EngineStats } from './types';

export const compactAdjustments = (adjustments: StatAdjustment[]): EngineAdjustmentInput[] =>
    adjustments.map((adjustment, sourceIndex) => ({
        sourceIndex,
        deltas: statsToTuple(adjustment.deltas)
    }));

export const adjustmentAt = (adjustments: StatAdjustment[], sourceIndex: number): StatAdjustment | undefined =>
    sourceIndex < 0 ? undefined : adjustments[sourceIndex];

export const statsToTuple = (stats: Partial<StatVector> | undefined): EngineStats =>
    ARMOR_STATS.map((stat) => Math.trunc(stats?.[stat] ?? 0)) as EngineStats;

export const tupleToStats = (stats: EngineStats): StatVector =>
    Object.fromEntries(ARMOR_STATS.map((stat, index) => [stat, stats[index]])) as StatVector;
