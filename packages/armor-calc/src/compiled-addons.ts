import { emptyStats } from './stats';
import { ARMOR_SLOTS, ARMOR_STATS, type ArmorItem, type ArmorSlot, type ArmorStat, type StatAdjustment, type StatVector } from './types';

const MAX_DISPLAY_STAT = 200;
const MAX_TUNING_ALLOCATION_CACHE = 2_048;
const BALANCED_TUNING = -2;
const NO_TUNING = -1;

type StatTuple = [number, number, number, number, number, number];
type SlotAssignments = [number, number, number, number, number];
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

export interface CompiledAddonSolveOptions {
    profiles: Record<ArmorSlot, CompiledAddonProfile>;
    baseStats: StatVector;
    targets: StatVector;
    dumpStat: ArmorStat;
    allowBalancedTuning: boolean;
    retainState: boolean;
}

export interface CompiledAddonCapsOptions {
    profiles: Record<ArmorSlot, CompiledAddonProfile>;
    baseStats: StatVector;
    targets: StatVector;
    dumpStat: ArmorStat;
    allowBalancedTuning: boolean;
    requestedStats: readonly ArmorStat[];
}

export interface StandardModCapsOptions {
    baseStats: StatVector;
    targets: StatVector;
    requestedStats: readonly ArmorStat[];
}

interface TuningAllocation {
    assignments: SlotAssignments;
    deltas: StatTuple;
    usedTuningCount: number;
}

interface ModRequest {
    statIndex: number;
    value: ModValue;
}

interface EvaluatedAllocation {
    allocation: TuningAllocation;
    finalStats: StatTuple;
    modRequests: ModRequest[];
    totalStats: number;
    usedTuningCount: number;
    wastedStats: number;
}

const allocationCache = new Map<string, TuningAllocation[]>();

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

        const negativeStats = ARMOR_STATS.filter((stat) => (option.deltas[stat] ?? 0) < 0);
        if (negativeStats.length !== 1 || negativeStats[0] !== dumpStat) {
            continue;
        }

        const positiveStats = ARMOR_STATS.filter((stat) => (option.deltas[stat] ?? 0) > 0);
        if (
            positiveStats.length !== 1 ||
            option.deltas[positiveStats[0]] !== 5 ||
            option.deltas[dumpStat] !== -5 ||
            !hasOnlyPairTuningValues(option, positiveStats[0], dumpStat)
        ) {
            return null;
        }

        const stat = positiveStats[0];
        tuningByStat[stat] = option;
        tuningMask |= 1 << ARMOR_STATS.indexOf(stat);
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

export const solveCompiledAddons = (options: CompiledAddonSolveOptions): AddonPlanResult | null => {
    const baseStats = toTuple(options.baseStats);
    const targets = toTuple(options.targets);
    const dumpStatIndex = ARMOR_STATS.indexOf(options.dumpStat);
    const profiles = ARMOR_SLOTS.map((slot) => options.profiles[slot]);
    const allocations = getTuningAllocations(profiles, dumpStatIndex, options.allowBalancedTuning, false);
    let best: EvaluatedAllocation | null = null;

    for (const allocation of allocations) {
        const evaluated = evaluateAllocation(baseStats, targets, dumpStatIndex, allocation);
        if (!evaluated) {
            continue;
        }

        if (!options.retainState) {
            return { valid: true, state: null };
        }

        if (!best || isBetterAllocation(evaluated, best)) {
            best = evaluated;
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

export const calculateCompiledAddonCaps = (options: CompiledAddonCapsOptions): StatVector => {
    const baseStats = toTuple(options.baseStats);
    const targets = toTuple(options.targets);
    const caps = emptyStats();
    const dumpStatIndex = ARMOR_STATS.indexOf(options.dumpStat);
    const requestedIndexes = options.requestedStats.map((stat) => ARMOR_STATS.indexOf(stat));
    const profiles = ARMOR_SLOTS.map((slot) => options.profiles[slot]);

    for (const allocation of getTuningAllocations(profiles, dumpStatIndex, options.allowBalancedTuning, true)) {
        const tunedStats = applyTuningAllocation(baseStats, allocation);
        updateCapsForStats(caps, tunedStats, targets, dumpStatIndex, requestedIndexes);
    }

    return caps;
};

export const calculateStandardModCaps = (options: StandardModCapsOptions): StatVector => {
    const caps = emptyStats();
    updateCapsForStats(
        caps,
        toTuple(options.baseStats),
        toTuple(options.targets),
        -1,
        options.requestedStats.map((stat) => ARMOR_STATS.indexOf(stat))
    );
    return caps;
};

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
): TuningAllocation[] => {
    const key = `${dumpStatIndex}:${allowBalancedTuning ? 'balanced' : 'pair'}:${requireTuningWhenAvailable ? 'required' : 'optional'}:${profiles
        .map((profile) => profile.signature)
        .join(',')}`;
    const cached = allocationCache.get(key);
    if (cached) {
        return cached;
    }

    const unique = new Map<string, TuningAllocation>();
    const assignments: SlotAssignments = [NO_TUNING, NO_TUNING, NO_TUNING, NO_TUNING, NO_TUNING];
    const deltas = zeroTuple();

    const visit = (slotIndex: number, usedTuningCount: number) => {
        if (slotIndex >= ARMOR_SLOTS.length) {
            const allocation = {
                assignments: [...assignments] as SlotAssignments,
                deltas: [...deltas] as StatTuple,
                usedTuningCount
            };
            unique.set(tupleKey(deltas), allocation);
            return;
        }

        const balanced = profiles[slotIndex].balancedTuning;
        if (!requireTuningWhenAvailable || (profiles[slotIndex].tuningMask === 0 && (!allowBalancedTuning || !balanced))) {
            assignments[slotIndex] = NO_TUNING;
            visit(slotIndex + 1, usedTuningCount);
        }

        let mask = profiles[slotIndex].tuningMask;
        while (mask > 0) {
            const bit = mask & -mask;
            const statIndex = 31 - Math.clz32(bit);
            assignments[slotIndex] = statIndex;
            deltas[statIndex] += 5;
            deltas[dumpStatIndex] -= 5;
            visit(slotIndex + 1, usedTuningCount + 1);
            deltas[statIndex] -= 5;
            deltas[dumpStatIndex] += 5;
            mask &= mask - 1;
        }

        if (allowBalancedTuning && balanced) {
            assignments[slotIndex] = BALANCED_TUNING;
            addAdjustmentInPlace(deltas, balanced, 1);
            visit(slotIndex + 1, usedTuningCount + 1);
            addAdjustmentInPlace(deltas, balanced, -1);
        }
    };

    visit(0, 0);
    const allocations = [...unique.values()].sort(
        (left, right) => left.usedTuningCount - right.usedTuningCount || tupleKey(left.deltas).localeCompare(tupleKey(right.deltas))
    );
    if (allocationCache.size >= MAX_TUNING_ALLOCATION_CACHE) {
        allocationCache.clear();
    }
    allocationCache.set(key, allocations);
    return allocations;
};

const evaluateAllocation = (
    baseStats: StatTuple,
    targets: StatTuple,
    dumpStatIndex: number,
    allocation: TuningAllocation
): EvaluatedAllocation | null => {
    const finalStats = applyTuningAllocation(baseStats, allocation);
    const modRequests: ModRequest[] = [];

    for (let index = 0; index < ARMOR_STATS.length; index++) {
        if (index === dumpStatIndex) {
            continue;
        }

        while (finalStats[index] < targets[index]) {
            const value = finalStats[index] + 10 <= MAX_DISPLAY_STAT ? 10 : 5;
            finalStats[index] += value;
            modRequests.push({ statIndex: index, value });
            if (modRequests.length > ARMOR_SLOTS.length) {
                return null;
            }
        }
    }

    let wastedStats = 0;
    let totalStats = 0;
    for (let index = 0; index < ARMOR_STATS.length; index++) {
        const displayedStat = Math.max(0, Math.min(MAX_DISPLAY_STAT, finalStats[index]));
        totalStats += displayedStat;
        if (index !== dumpStatIndex) {
            wastedStats += Math.max(0, displayedStat - targets[index]);
        }
    }

    return {
        allocation,
        finalStats,
        modRequests,
        totalStats,
        usedTuningCount: allocation.usedTuningCount,
        wastedStats
    };
};

const applyTuningAllocation = (baseStats: StatTuple, allocation: TuningAllocation): StatTuple => {
    const tunedStats = [...baseStats] as StatTuple;
    for (let index = 0; index < ARMOR_STATS.length; index++) {
        tunedStats[index] += allocation.deltas[index];
    }
    return tunedStats;
};

const minimumModSlots = (current: number, target: number): number => Math.max(0, Math.ceil((target - current) / 10));

const updateCapsForStats = (
    caps: StatVector,
    currentStats: StatTuple,
    targets: StatTuple,
    dumpStatIndex: number,
    requestedIndexes: number[]
): void => {
    const requiredSlots = zeroTuple();
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

const isBetterAllocation = (candidate: EvaluatedAllocation, current: EvaluatedAllocation): boolean =>
    candidate.totalStats > current.totalStats ||
    (candidate.totalStats === current.totalStats && candidate.usedTuningCount > current.usedTuningCount) ||
    (candidate.totalStats === current.totalStats &&
        candidate.usedTuningCount === current.usedTuningCount &&
        candidate.wastedStats < current.wastedStats);

const materializeAddonState = (profiles: CompiledAddonProfile[], evaluated: EvaluatedAllocation): AddonState => {
    const choices = {} as Record<ArmorSlot, AddonChoice>;

    for (let slotIndex = 0; slotIndex < ARMOR_SLOTS.length; slotIndex++) {
        const slot = ARMOR_SLOTS[slotIndex];
        const profile = profiles[slotIndex];
        const modRequest = evaluated.modRequests[slotIndex];
        const statMod = modRequest
            ? profile.statMods[ARMOR_STATS[modRequest.statIndex]][modRequest.value === 10 ? 'major' : 'minor']
            : undefined;
        const tuningStatIndex = evaluated.allocation.assignments[slotIndex];
        const tuning =
            tuningStatIndex === NO_TUNING
                ? undefined
                : tuningStatIndex === BALANCED_TUNING
                  ? profile.balancedTuning
                  : profile.tuningByStat[ARMOR_STATS[tuningStatIndex]];
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

const hasOnlyPairTuningValues = (option: StatAdjustment, positiveStat: ArmorStat, dumpStat: ArmorStat): boolean =>
    ARMOR_STATS.every((stat) => {
        const value = option.deltas[stat] ?? 0;
        if (stat === positiveStat) {
            return value === 5;
        }
        if (stat === dumpStat) {
            return value === -5;
        }
        return value === 0;
    });

const isZeroAdjustment = (option: StatAdjustment): boolean => ARMOR_STATS.every((stat) => (option.deltas[stat] ?? 0) === 0);

const isBalancedTuning = (option: StatAdjustment): boolean => {
    const values = ARMOR_STATS.map((stat) => option.deltas[stat] ?? 0);
    return values.filter((value) => value === 1).length >= 3 && values.every((value) => value === 0 || value === 1);
};

const addAdjustmentInPlace = (tuple: StatTuple, adjustment: StatAdjustment, multiplier: 1 | -1): void => {
    for (let index = 0; index < ARMOR_STATS.length; index++) {
        tuple[index] += (adjustment.deltas[ARMOR_STATS[index]] ?? 0) * multiplier;
    }
};

const zeroTuple = (): StatTuple => [0, 0, 0, 0, 0, 0];

const tupleKey = (tuple: StatTuple): string => tuple.join(',');

const toTuple = (stats: StatVector): StatTuple => [stats.health, stats.melee, stats.grenade, stats.super, stats.class, stats.weapons];

const adjustmentMask = (adjustment: StatAdjustment): number =>
    ARMOR_STATS.reduce((mask, stat, index) => mask | ((adjustment.deltas[stat] ?? 0) > 0 ? 1 << index : 0), 0);

const toStats = (tuple: StatTuple): StatVector => ({
    health: tuple[0],
    melee: tuple[1],
    grenade: tuple[2],
    super: tuple[3],
    class: tuple[4],
    weapons: tuple[5]
});
