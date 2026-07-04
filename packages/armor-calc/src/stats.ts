import { ARMOR_STATS, type ArmorStat, type StatAdjustment, type StatVector } from './types';

export const ZERO_STATS: StatVector = {
    health: 0,
    melee: 0,
    grenade: 0,
    super: 0,
    class: 0,
    weapons: 0
};

export function emptyStats(): StatVector {
    return { ...ZERO_STATS };
}

export function normalizeTargets(targets: Partial<StatVector>): StatVector {
    const normalized = emptyStats();

    for (const stat of ARMOR_STATS) {
        normalized[stat] = clampStatTarget(targets[stat] ?? 0);
    }

    return normalized;
}

export function clampStatTarget(value: number) {
    if (!Number.isFinite(value)) {
        return 0;
    }

    return Math.max(0, Math.min(200, Math.trunc(value)));
}

export function addStats(left: StatVector, right: Partial<StatVector>): StatVector {
    const next = emptyStats();

    for (const stat of ARMOR_STATS) {
        next[stat] = left[stat] + (right[stat] ?? 0);
    }

    return next;
}

export function subtractStats(left: StatVector, right: Partial<StatVector>): StatVector {
    const next = emptyStats();

    for (const stat of ARMOR_STATS) {
        next[stat] = left[stat] - (right[stat] ?? 0);
    }

    return next;
}

export function sumStatVectors(vectors: Array<Partial<StatVector>>): StatVector {
    let total = emptyStats();

    for (const vector of vectors) {
        total = addStats(total, vector);
    }

    return total;
}

export function statTotal(stats: StatVector) {
    return ARMOR_STATS.reduce((total, stat) => total + stats[stat], 0);
}

export function meetsTargets(stats: StatVector, targets: StatVector) {
    return ARMOR_STATS.every((stat) => stats[stat] >= targets[stat]);
}

export function wastedStats(stats: StatVector, targets: StatVector) {
    return ARMOR_STATS.reduce((total, stat) => total + Math.max(0, stats[stat] - targets[stat]), 0);
}

export function adjustmentValue(adjustment: StatAdjustment, stat: ArmorStat) {
    return adjustment.deltas[stat] ?? 0;
}

export function adjustmentKey(adjustment?: StatAdjustment) {
    return adjustment?.id ?? 'none';
}

export function createAdjustment(id: string, name: string, deltas: Partial<StatVector>): StatAdjustment {
    return { id, name, deltas };
}
