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

export function clampTargetsToCaps(targets: StatVector, caps: StatVector, currentDumpStat: ArmorStat | ''): StatVector {
    let changed = false;
    const next = { ...targets };

    for (const stat of ARMOR_STATS) {
        const cap = statCapForDisplay(caps, stat, currentDumpStat);
        const value = Math.min(clampTarget(next[stat]), cap);
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

export function targetsAreWithinCaps(targets: StatVector, caps: StatVector, currentDumpStat: ArmorStat | '') {
    return clampTargetsToCaps(targets, caps, currentDumpStat) === targets;
}

export function statCapForDisplay(caps: StatVector, stat: ArmorStat, currentDumpStat: ArmorStat | '') {
    return currentDumpStat === stat ? 0 : clampTarget(caps[stat]);
}
