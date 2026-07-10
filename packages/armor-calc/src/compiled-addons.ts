import { emptyStats } from './stats';
import { ARMOR_SLOTS, ARMOR_STATS, type ArmorItem, type ArmorSlot, type ArmorStat, type StatAdjustment, type StatVector } from './types';

const MAX_DISPLAY_STAT = 200;
const MAX_TUNING_ALLOCATION_CACHE = 2_048;
const TUNING_CHOICE_BITS = 3;
const TUNING_CHOICE_MASK = (1 << TUNING_CHOICE_BITS) - 1;
const NO_TUNING = 0;
const BALANCED_TUNING = 1;
const STAT_TUNING_OFFSET = 2;
const TUNING_DELTA_OFFSET = 25;
const TUNING_DELTA_BASE = 56;

type StatTuple = [number, number, number, number, number, number];
type ModValue = 5 | 10;

export interface AddonChoice {
    statMod?: StatAdjustment | undefined;
    tuning?: StatAdjustment | undefined;
    deltas: StatVector;
}

export interface AddonState {
    stats: StatVector;
    choices: Record<ArmorSlot, AddonChoice>;
}

export interface AddonPlanResult {
    valid: boolean;
    state: AddonState | null;
}

interface StatModOptions {
    minor: StatAdjustment;
    major: StatAdjustment;
}

export interface CompiledAddonProfile {
    statMods: Record<ArmorStat, StatModOptions>;
    tuningByStat: Partial<Record<ArmorStat, StatAdjustment>>;
    tuningMask: number;
    signature: number;
    balancedTuning?: StatAdjustment | undefined;
}

export interface CompiledAddonWorkspace {
    workingStats: StatTuple;
    workingModCodes: Uint8Array;
    requiredModSlots: StatTuple;
}

interface CompactTuningAllocations {
    assignments: Uint16Array;
    deltas: Int8Array;
}

interface EvaluatedAllocation {
    tuningAssignment: number;
    finalStats: StatTuple;
    modCodes: Uint8Array;
    totalStats: number;
    usedTuningCount: number;
    wastedStats: number;
}

const allocationCache = new Map<string, CompactTuningAllocations>();

export const createCompiledAddonWorkspace = (): CompiledAddonWorkspace => ({
    workingStats: zeroTuple(),
    workingModCodes: new Uint8Array(ARMOR_SLOTS.length),
    requiredModSlots: zeroTuple()
});

export const createCompiledAddonProfile = (item: ArmorItem, dumpStat: ArmorStat): CompiledAddonProfile | null => {
    const statMods = collectStandardStatMods(item);
    if (!statMods) {
        return null;
    }

    const tuningByStat: Partial<Record<ArmorStat, StatAdjustment>> = {};
    let balancedTuning: StatAdjustment | undefined;
    let tuningMask = 0;
    let hasNoTuning = false;

    for (const option of item.tuningOptions) {
        if (isZeroAdjustment(option)) {
            hasNoTuning = true;
            continue;
        }

        if (isBalancedTuning(option)) {
            balancedTuning = option;
            continue;
        }

        let negativeStatIndex = -1;
        let positiveStatIndex = -1;
        let negativeStatCount = 0;
        let positiveStatCount = 0;
        for (let statIndex = 0; statIndex < ARMOR_STATS.length; statIndex++) {
            const value = option.deltas[ARMOR_STATS[statIndex]] ?? 0;
            if (value < 0) {
                negativeStatIndex = statIndex;
                negativeStatCount += 1;
            } else if (value > 0) {
                positiveStatIndex = statIndex;
                positiveStatCount += 1;
            }
        }

        if (negativeStatCount !== 1 || ARMOR_STATS[negativeStatIndex] !== dumpStat) {
            continue;
        }

        if (positiveStatCount !== 1) {
            return null;
        }

        const positiveStat = ARMOR_STATS[positiveStatIndex] as ArmorStat;
        if (
            option.deltas[positiveStat] !== 5 ||
            option.deltas[dumpStat] !== -5 ||
            !hasOnlyPairTuningValues(option, positiveStat, dumpStat)
        ) {
            return null;
        }

        tuningByStat[positiveStat] = option;
        tuningMask |= 1 << positiveStatIndex;
    }

    if (!hasNoTuning) {
        return null;
    }

    return {
        statMods,
        tuningByStat,
        tuningMask,
        signature: tuningMask | (balancedTuning ? adjustmentMask(balancedTuning) << ARMOR_STATS.length : 0),
        balancedTuning
    };
};

export const solveCompiledAddons = (
    profiles: CompiledAddonProfile[],
    baseStats: StatTuple,
    targets: StatTuple,
    dumpStatIndex: number,
    allowBalancedTuning: boolean,
    retainState: boolean,
    workspace: CompiledAddonWorkspace
): AddonPlanResult => {
    const allocations = getTuningAllocations(profiles, dumpStatIndex, allowBalancedTuning, false);
    const { workingStats, workingModCodes } = workspace;
    let best: EvaluatedAllocation | null = null;

    for (let allocationIndex = 0; allocationIndex < allocations.assignments.length; allocationIndex++) {
        const deltaOffset = allocationIndex * ARMOR_STATS.length;
        for (let statIndex = 0; statIndex < ARMOR_STATS.length; statIndex++) {
            workingStats[statIndex] = baseStats[statIndex] + allocations.deltas[deltaOffset + statIndex];
        }

        const modCount = applyRequiredMods(workingStats, workingModCodes, targets, dumpStatIndex);
        if (modCount < 0) {
            continue;
        }

        if (!retainState) {
            return { valid: true, state: null };
        }

        let totalStats = 0;
        let wastedStats = 0;
        for (let statIndex = 0; statIndex < ARMOR_STATS.length; statIndex++) {
            const displayedStat = Math.max(0, Math.min(MAX_DISPLAY_STAT, workingStats[statIndex]));
            totalStats += displayedStat;
            if (statIndex !== dumpStatIndex) {
                wastedStats += Math.max(0, displayedStat - targets[statIndex]);
            }
        }

        const tuningAssignment = allocations.assignments[allocationIndex];
        const usedTuningCount = countUsedTunings(tuningAssignment);
        if (!best || isBetterAllocation(totalStats, usedTuningCount, wastedStats, best)) {
            best = {
                tuningAssignment,
                finalStats: [...workingStats] as StatTuple,
                modCodes: workingModCodes.slice(0, modCount),
                totalStats,
                usedTuningCount,
                wastedStats
            };
        }
    }

    if (!best) {
        return { valid: false, state: null };
    }

    return {
        valid: true,
        state: materializeAddonState(profiles, best)
    };
};

export const updateCompiledAddonCaps = (
    caps: StatVector,
    profiles: CompiledAddonProfile[],
    baseStats: StatTuple,
    targets: StatTuple,
    dumpStatIndex: number,
    allowBalancedTuning: boolean,
    requestedIndexes: readonly number[],
    workspace: CompiledAddonWorkspace
): void => {
    const allocations = getTuningAllocations(profiles, dumpStatIndex, allowBalancedTuning, true);
    const { workingStats, requiredModSlots } = workspace;

    for (let allocationIndex = 0; allocationIndex < allocations.assignments.length; allocationIndex++) {
        const deltaOffset = allocationIndex * ARMOR_STATS.length;
        for (let statIndex = 0; statIndex < ARMOR_STATS.length; statIndex++) {
            workingStats[statIndex] = baseStats[statIndex] + allocations.deltas[deltaOffset + statIndex];
        }
        updateCapsForStats(caps, workingStats, targets, dumpStatIndex, requestedIndexes, requiredModSlots);
    }
};

export const updateStandardModCaps = (
    caps: StatVector,
    baseStats: StatTuple,
    targets: StatTuple,
    requestedIndexes: readonly number[],
    workspace: CompiledAddonWorkspace
): void => updateCapsForStats(caps, baseStats, targets, -1, requestedIndexes, workspace.requiredModSlots);

const collectStandardStatMods = (item: ArmorItem): Record<ArmorStat, StatModOptions> | null => {
    const none = item.statModOptions.find(isZeroAdjustment);
    if (!none) {
        return null;
    }

    for (const option of item.statModOptions) {
        if (isZeroAdjustment(option)) {
            continue;
        }

        const changedStats = ARMOR_STATS.filter((stat) => (option.deltas[stat] ?? 0) !== 0);
        const value = changedStats.length === 1 ? option.deltas[changedStats[0]] : undefined;
        if (changedStats.length !== 1 || (value !== 5 && value !== 10)) {
            return null;
        }
    }

    const statMods = {} as Record<ArmorStat, StatModOptions>;
    for (const stat of ARMOR_STATS) {
        const minor = findSingleStatMod(item, stat, 5);
        const major = findSingleStatMod(item, stat, 10);
        if (!minor || !major) {
            return null;
        }
        statMods[stat] = { minor, major };
    }

    return statMods;
};

const findSingleStatMod = (item: ArmorItem, stat: ArmorStat, value: ModValue): StatAdjustment | undefined =>
    item.statModOptions.find(
        (option) =>
            option.deltas[stat] === value && ARMOR_STATS.every((candidate) => candidate === stat || (option.deltas[candidate] ?? 0) === 0)
    );

// Pair tuning choices depend only on each piece's supported +5 stat mask.
const getTuningAllocations = (
    profiles: CompiledAddonProfile[],
    dumpStatIndex: number,
    allowBalancedTuning: boolean,
    requireTuningWhenAvailable: boolean
): CompactTuningAllocations => {
    const key = `${dumpStatIndex}:${allowBalancedTuning ? 'balanced' : 'pair'}:${requireTuningWhenAvailable ? 'required' : 'optional'}:${profiles
        .map((profile) => profile.signature)
        .join(',')}`;
    const cached = allocationCache.get(key);
    if (cached) {
        return cached;
    }

    const unique = new Map<number, number>();
    const deltas = zeroTuple();

    const visit = (slotIndex: number, packedAssignment: number) => {
        if (slotIndex >= ARMOR_SLOTS.length) {
            unique.set(encodeTuningDeltas(deltas), packedAssignment);
            return;
        }

        const balanced = profiles[slotIndex].balancedTuning;
        if (!requireTuningWhenAvailable || (profiles[slotIndex].tuningMask === 0 && (!allowBalancedTuning || !balanced))) {
            visit(slotIndex + 1, packTuningChoice(packedAssignment, slotIndex, NO_TUNING));
        }

        let mask = profiles[slotIndex].tuningMask;
        while (mask > 0) {
            const bit = mask & -mask;
            const statIndex = 31 - Math.clz32(bit);
            deltas[statIndex] += 5;
            deltas[dumpStatIndex] -= 5;
            visit(slotIndex + 1, packTuningChoice(packedAssignment, slotIndex, statIndex + STAT_TUNING_OFFSET));
            deltas[statIndex] -= 5;
            deltas[dumpStatIndex] += 5;
            mask &= mask - 1;
        }

        if (allowBalancedTuning && balanced) {
            addAdjustmentInPlace(deltas, balanced, 1);
            visit(slotIndex + 1, packTuningChoice(packedAssignment, slotIndex, BALANCED_TUNING));
            addAdjustmentInPlace(deltas, balanced, -1);
        }
    };

    visit(0, 0);
    const assignments = new Uint16Array(unique.size);
    const compactDeltas = new Int8Array(unique.size * ARMOR_STATS.length);
    let allocationIndex = 0;
    unique.forEach((packedAssignment, encodedDeltas) => {
        assignments[allocationIndex] = packedAssignment;
        decodeTuningDeltas(encodedDeltas, compactDeltas, allocationIndex * ARMOR_STATS.length);
        allocationIndex += 1;
    });

    const allocations = { assignments, deltas: compactDeltas };
    if (allocationCache.size >= MAX_TUNING_ALLOCATION_CACHE) {
        allocationCache.clear();
    }
    allocationCache.set(key, allocations);
    return allocations;
};

const applyRequiredMods = (finalStats: StatTuple, modCodes: Uint8Array, targets: StatTuple, dumpStatIndex: number): number => {
    let modCount = 0;

    for (let statIndex = 0; statIndex < ARMOR_STATS.length; statIndex++) {
        if (statIndex === dumpStatIndex) {
            continue;
        }

        while (finalStats[statIndex] < targets[statIndex]) {
            if (modCount >= ARMOR_SLOTS.length) {
                return -1;
            }

            const value: ModValue = finalStats[statIndex] + 10 <= MAX_DISPLAY_STAT ? 10 : 5;
            finalStats[statIndex] += value;
            modCodes[modCount] = encodeMod(statIndex, value);
            modCount += 1;
        }
    }

    return modCount;
};

const minimumModSlots = (current: number, target: number): number => Math.max(0, Math.ceil((target - current) / 10));

const updateCapsForStats = (
    caps: StatVector,
    currentStats: StatTuple,
    targets: StatTuple,
    dumpStatIndex: number,
    requestedIndexes: readonly number[],
    requiredSlots: StatTuple
): void => {
    let totalRequiredSlots = 0;

    for (let index = 0; index < ARMOR_STATS.length; index++) {
        if (index === dumpStatIndex) {
            continue;
        }

        requiredSlots[index] = minimumModSlots(currentStats[index], targets[index]);
        totalRequiredSlots += requiredSlots[index];
    }

    for (const scoreIndex of requestedIndexes) {
        if (scoreIndex === dumpStatIndex) {
            continue;
        }

        const remainingSlots = ARMOR_SLOTS.length - (totalRequiredSlots - requiredSlots[scoreIndex]);
        if (remainingSlots < 0) {
            continue;
        }

        const stat = ARMOR_STATS[scoreIndex];
        caps[stat] = Math.max(caps[stat], Math.max(0, Math.min(MAX_DISPLAY_STAT, currentStats[scoreIndex] + remainingSlots * 10)));
    }
};

const isBetterAllocation = (totalStats: number, usedTuningCount: number, wastedStats: number, current: EvaluatedAllocation): boolean =>
    totalStats > current.totalStats ||
    (totalStats === current.totalStats && usedTuningCount > current.usedTuningCount) ||
    (totalStats === current.totalStats && usedTuningCount === current.usedTuningCount && wastedStats < current.wastedStats);

const materializeAddonState = (profiles: CompiledAddonProfile[], evaluated: EvaluatedAllocation): AddonState => {
    const choices = {} as Record<ArmorSlot, AddonChoice>;

    for (let slotIndex = 0; slotIndex < ARMOR_SLOTS.length; slotIndex++) {
        const slot = ARMOR_SLOTS[slotIndex];
        const profile = profiles[slotIndex];
        const modCode = evaluated.modCodes[slotIndex];
        const statMod =
            modCode === undefined
                ? undefined
                : profile.statMods[ARMOR_STATS[decodeModStatIndex(modCode)]][decodeModValue(modCode) === 10 ? 'major' : 'minor'];
        const tuningChoice = unpackTuningChoice(evaluated.tuningAssignment, slotIndex);
        const tuning =
            tuningChoice === NO_TUNING
                ? undefined
                : tuningChoice === BALANCED_TUNING
                  ? profile.balancedTuning
                  : profile.tuningByStat[ARMOR_STATS[tuningChoice - STAT_TUNING_OFFSET]];
        const deltas = emptyStats();

        for (const stat of ARMOR_STATS) {
            deltas[stat] = (statMod?.deltas[stat] ?? 0) + (tuning?.deltas[stat] ?? 0);
        }

        choices[slot] = { statMod, tuning, deltas };
    }

    return {
        stats: toStats(evaluated.finalStats),
        choices
    };
};

const hasOnlyPairTuningValues = (option: StatAdjustment, positiveStat: ArmorStat, dumpStat: ArmorStat): boolean => {
    for (const stat of ARMOR_STATS) {
        const value = option.deltas[stat] ?? 0;
        if (stat === positiveStat) {
            if (value !== 5) {
                return false;
            }
        } else if (stat === dumpStat) {
            if (value !== -5) {
                return false;
            }
        } else if (value !== 0) {
            return false;
        }
    }
    return true;
};

const isZeroAdjustment = (option: StatAdjustment): boolean => {
    for (const stat of ARMOR_STATS) {
        if ((option.deltas[stat] ?? 0) !== 0) {
            return false;
        }
    }
    return true;
};

const isBalancedTuning = (option: StatAdjustment): boolean => {
    let positiveCount = 0;
    for (const stat of ARMOR_STATS) {
        const value = option.deltas[stat] ?? 0;
        if (value === 1) {
            positiveCount += 1;
        } else if (value !== 0) {
            return false;
        }
    }
    return positiveCount >= 3;
};

const addAdjustmentInPlace = (tuple: StatTuple, adjustment: StatAdjustment, multiplier: 1 | -1): void => {
    for (let index = 0; index < ARMOR_STATS.length; index++) {
        tuple[index] += (adjustment.deltas[ARMOR_STATS[index]] ?? 0) * multiplier;
    }
};

const zeroTuple = (): StatTuple => [0, 0, 0, 0, 0, 0];

const packTuningChoice = (assignment: number, slotIndex: number, choice: number): number =>
    assignment | (choice << (slotIndex * TUNING_CHOICE_BITS));

const unpackTuningChoice = (assignment: number, slotIndex: number): number =>
    (assignment >> (slotIndex * TUNING_CHOICE_BITS)) & TUNING_CHOICE_MASK;

const countUsedTunings = (assignment: number): number => {
    let count = 0;
    for (let slotIndex = 0; slotIndex < ARMOR_SLOTS.length; slotIndex++) {
        if (unpackTuningChoice(assignment, slotIndex) !== NO_TUNING) {
            count += 1;
        }
    }
    return count;
};

const encodeTuningDeltas = (deltas: StatTuple): number => {
    let encoded = 0;
    for (let statIndex = 0; statIndex < ARMOR_STATS.length; statIndex++) {
        encoded = encoded * TUNING_DELTA_BASE + deltas[statIndex] + TUNING_DELTA_OFFSET;
    }
    return encoded;
};

const decodeTuningDeltas = (encoded: number, target: Int8Array, targetOffset: number): void => {
    for (let statIndex = ARMOR_STATS.length - 1; statIndex >= 0; statIndex--) {
        target[targetOffset + statIndex] = (encoded % TUNING_DELTA_BASE) - TUNING_DELTA_OFFSET;
        encoded = Math.floor(encoded / TUNING_DELTA_BASE);
    }
};

const encodeMod = (statIndex: number, value: ModValue): number => (statIndex << 1) | (value === 10 ? 1 : 0);

const decodeModStatIndex = (code: number): number => code >> 1;

const decodeModValue = (code: number): ModValue => (code & 1 ? 10 : 5);

const adjustmentMask = (adjustment: StatAdjustment): number => {
    let mask = 0;
    for (let statIndex = 0; statIndex < ARMOR_STATS.length; statIndex++) {
        if ((adjustment.deltas[ARMOR_STATS[statIndex]] ?? 0) > 0) {
            mask |= 1 << statIndex;
        }
    }
    return mask;
};

const toStats = (tuple: StatTuple): StatVector => ({
    health: tuple[0],
    melee: tuple[1],
    grenade: tuple[2],
    super: tuple[3],
    class: tuple[4],
    weapons: tuple[5]
});
