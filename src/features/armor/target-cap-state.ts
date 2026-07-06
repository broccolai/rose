import { ARMOR_STATS, type ArmorStat, type StatVector } from '@armor-calc';

import { clampTarget } from '@/features/armor/calculator-preferences';

export const MAX_STAT_TARGET_CAPS: StatVector = {
    health: 200,
    melee: 200,
    grenade: 200,
    super: 200,
    class: 200,
    weapons: 200
};

export const UNBALANCED_STAT_TARGET_STEP = 5;

export function clampTargetsToCaps(
    targets: StatVector,
    caps: StatVector,
    currentDumpStat: ArmorStat | '',
    allowBalancedTuning = true
): StatVector {
    let changed = false;
    const next = { ...targets };

    for (const stat of ARMOR_STATS) {
        const cap = statCapForDisplay(caps, stat, currentDumpStat);
        const value = snapStatTarget(next[stat], cap, allowBalancedTuning);
        if (value !== next[stat]) {
            next[stat] = value;
            changed = true;
        }
    }

    return changed ? next : targets;
}

export function createPendingTargetCaps(targets: StatVector, currentDumpStat: ArmorStat | ''): StatVector {
    return clampTargetsToCaps(targets, MAX_STAT_TARGET_CAPS, currentDumpStat);
}

export function applyVerifiedTargetCap(caps: StatVector, stat: ArmorStat, cap: number, currentDumpStat: ArmorStat | ''): StatVector {
    return {
        ...caps,
        [stat]: statCapForDisplay({ ...caps, [stat]: cap }, stat, currentDumpStat)
    };
}

export function targetsAreWithinCaps(targets: StatVector, caps: StatVector, currentDumpStat: ArmorStat | '', allowBalancedTuning = true) {
    return clampTargetsToCaps(targets, caps, currentDumpStat, allowBalancedTuning) === targets;
}

export function statCapForDisplay(caps: StatVector, stat: ArmorStat, currentDumpStat: ArmorStat | '') {
    return currentDumpStat === stat ? 0 : clampTarget(caps[stat]);
}

export function statTargetStep(allowBalancedTuning: boolean) {
    return allowBalancedTuning ? 1 : UNBALANCED_STAT_TARGET_STEP;
}

export function statTargetMax(cap: number, allowBalancedTuning: boolean) {
    const clampedCap = clampTarget(cap);
    const step = statTargetStep(allowBalancedTuning);

    return Math.floor(clampedCap / step) * step;
}

export function snapStatTarget(value: number, cap: number, allowBalancedTuning: boolean) {
    const max = statTargetMax(cap, allowBalancedTuning);
    const step = statTargetStep(allowBalancedTuning);
    const clampedValue = Math.max(0, Math.min(clampTarget(value), max));

    return Math.max(0, Math.min(Math.round(clampedValue / step) * step, max));
}
