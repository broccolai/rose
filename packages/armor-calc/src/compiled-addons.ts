import { emptyStats } from './stats';
import { ARMOR_SLOTS, ARMOR_STATS, type ArmorItem, type ArmorSlot, type ArmorStat, type StatAdjustment, type StatVector } from './types';

const MAX_DISPLAY_STAT = 200;
const MAX_TUNING_ALLOCATION_CACHE = 2_048;
const TUNING_CHOICE_BITS = 5;
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
    minor?: StatAdjustment | undefined;
    major: StatAdjustment;
}

interface CompiledTuningChoice {
    adjustment: StatAdjustment;
    deltas: StatTuple;
    positiveStatIndex: number;
    negativeStatIndex: number;
}

export interface CompiledAddonProfile {
    statMods: Record<ArmorStat, StatModOptions>;
    tuningChoices: CompiledTuningChoice[];
    signature: number;
    balancedTuning?: StatAdjustment | undefined;
}

export interface CompiledAddonWorkspace {
    workingStats: StatTuple;
    balancedBaseStats: StatTuple;
    workingModCodes: Uint8Array;
    requiredModSlots: StatTuple;
    capTargets: StatTuple;
    deficitUnits: Uint8Array;
    sourceUnits: Uint8Array;
    workingTuningCodes: Uint8Array;
    workingModCounts: Uint8Array;
    tuningDestinationSlots: Uint8Array;
}

interface CompactTuningAllocations {
    assignments: Uint32Array;
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
    balancedBaseStats: zeroTuple(),
    workingModCodes: new Uint8Array(ARMOR_SLOTS.length),
    requiredModSlots: zeroTuple(),
    capTargets: zeroTuple(),
    deficitUnits: new Uint8Array(ARMOR_STATS.length),
    sourceUnits: new Uint8Array(ARMOR_STATS.length),
    workingTuningCodes: new Uint8Array(ARMOR_SLOTS.length),
    workingModCounts: new Uint8Array(ARMOR_STATS.length),
    tuningDestinationSlots: new Uint8Array(ARMOR_STATS.length)
});

export const createCompiledAddonProfile = (item: ArmorItem, dumpStat?: ArmorStat): CompiledAddonProfile | null => {
    const statMods = collectStandardStatMods(item);
    if (!statMods) {
        return null;
    }

    const tuningChoicesByIndex: Array<CompiledTuningChoice | undefined> = [];
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

        if (negativeStatCount !== 1) {
            return null;
        }

        if (dumpStat && ARMOR_STATS[negativeStatIndex] !== dumpStat) {
            continue;
        }

        if (positiveStatCount !== 1) {
            return null;
        }

        const positiveStat = ARMOR_STATS[positiveStatIndex] as ArmorStat;
        const negativeStat = ARMOR_STATS[negativeStatIndex] as ArmorStat;
        if (
            option.deltas[positiveStat] !== 5 ||
            option.deltas[negativeStat] !== -5 ||
            !hasOnlyPairTuningValues(option, positiveStat, negativeStat)
        ) {
            return null;
        }

        const choiceIndex = pairTuningIndex(positiveStatIndex, negativeStatIndex);
        if (!tuningChoicesByIndex[choiceIndex]) {
            tuningChoicesByIndex[choiceIndex] = {
                adjustment: option,
                deltas: adjustmentTuple(option),
                positiveStatIndex,
                negativeStatIndex
            };
            tuningMask += 2 ** choiceIndex;
        }
    }

    if (!hasNoTuning) {
        return null;
    }

    const tuningChoices = tuningChoicesByIndex.filter((choice): choice is CompiledTuningChoice => choice !== undefined);

    return {
        statMods,
        tuningChoices,
        signature: tuningMask * 2 ** ARMOR_STATS.length + (balancedTuning ? adjustmentMask(balancedTuning) : 0),
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
    if (dumpStatIndex < 0) {
        return solveUnrestrictedAddons(profiles, baseStats, targets, allowBalancedTuning, retainState, workspace);
    }

    const allocations = getTuningAllocations(profiles, allowBalancedTuning, false);
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
    if (dumpStatIndex < 0) {
        updateUnrestrictedAddonCaps(caps, profiles, baseStats, targets, allowBalancedTuning, requestedIndexes, workspace);
        return;
    }

    const allocations = getTuningAllocations(profiles, allowBalancedTuning, dumpStatIndex >= 0);
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

interface UnrestrictedPlan {
    tuningAssignment: number;
    modCount: number;
    usedTuningCount: number;
}

const solveUnrestrictedAddons = (
    profiles: CompiledAddonProfile[],
    baseStats: StatTuple,
    targets: StatTuple,
    allowBalancedTuning: boolean,
    retainState: boolean,
    workspace: CompiledAddonWorkspace
): AddonPlanResult => {
    const maskLimit = allowBalancedTuning ? 1 << ARMOR_SLOTS.length : 1;
    let best: EvaluatedAllocation | null = null;

    for (let balancedMask = 0; balancedMask < maskLimit; balancedMask++) {
        const plan = planUnrestrictedMask(profiles, baseStats, targets, balancedMask, workspace);
        if (!plan) {
            continue;
        }

        if (!retainState) {
            return { valid: true, state: null };
        }

        let totalStats = 0;
        let wastedStats = 0;
        for (let statIndex = 0; statIndex < ARMOR_STATS.length; statIndex++) {
            const displayedStat = Math.max(0, Math.min(MAX_DISPLAY_STAT, workspace.workingStats[statIndex]));
            totalStats += displayedStat;
            wastedStats += Math.max(0, displayedStat - targets[statIndex]);
        }

        if (!best || isBetterAllocation(totalStats, plan.usedTuningCount, wastedStats, best)) {
            best = {
                tuningAssignment: plan.tuningAssignment,
                finalStats: [...workspace.workingStats] as StatTuple,
                modCodes: workspace.workingModCodes.slice(0, plan.modCount),
                totalStats,
                usedTuningCount: plan.usedTuningCount,
                wastedStats
            };
        }
    }

    return best ? { valid: true, state: materializeAddonState(profiles, best) } : { valid: false, state: null };
};

const updateUnrestrictedAddonCaps = (
    caps: StatVector,
    profiles: CompiledAddonProfile[],
    baseStats: StatTuple,
    targets: StatTuple,
    allowBalancedTuning: boolean,
    requestedIndexes: readonly number[],
    workspace: CompiledAddonWorkspace
): void => {
    const capTargets = workspace.capTargets;
    copyTuple(targets, capTargets);

    for (const scoreIndex of requestedIndexes) {
        const stat = ARMOR_STATS[scoreIndex];
        let low = caps[stat];
        let high = MAX_DISPLAY_STAT;

        while (low < high) {
            const candidate = Math.ceil((low + high) / 2);
            capTargets[scoreIndex] = candidate;
            if (hasUnrestrictedPlan(profiles, baseStats, capTargets, allowBalancedTuning, workspace)) {
                low = candidate;
            } else {
                high = candidate - 1;
            }
        }

        caps[stat] = low;
        capTargets[scoreIndex] = targets[scoreIndex];
    }
};

const hasUnrestrictedPlan = (
    profiles: CompiledAddonProfile[],
    baseStats: StatTuple,
    targets: StatTuple,
    allowBalancedTuning: boolean,
    workspace: CompiledAddonWorkspace
): boolean => {
    const sharedBalanced = allowBalancedTuning ? sharedBalancedTuning(profiles) : undefined;
    if (sharedBalanced) {
        for (let balancedCount = 0; balancedCount <= ARMOR_SLOTS.length; balancedCount++) {
            if (planUnrestrictedBalancedCount(profiles, baseStats, targets, balancedCount, sharedBalanced, workspace)) {
                return true;
            }
        }
        return false;
    }

    const maskLimit = allowBalancedTuning ? 1 << ARMOR_SLOTS.length : 1;
    for (let balancedMask = 0; balancedMask < maskLimit; balancedMask++) {
        if (planUnrestrictedMask(profiles, baseStats, targets, balancedMask, workspace)) {
            return true;
        }
    }
    return false;
};

const sharedBalancedTuning = (profiles: CompiledAddonProfile[]): StatAdjustment | undefined => {
    const first = profiles[0]?.balancedTuning;
    if (!first) {
        return undefined;
    }

    for (let profileIndex = 1; profileIndex < profiles.length; profileIndex++) {
        const candidate = profiles[profileIndex].balancedTuning;
        if (!candidate || !sameAdjustmentDeltas(first, candidate)) {
            return undefined;
        }
    }
    return first;
};

const sameAdjustmentDeltas = (left: StatAdjustment, right: StatAdjustment): boolean => {
    for (const stat of ARMOR_STATS) {
        if ((left.deltas[stat] ?? 0) !== (right.deltas[stat] ?? 0)) {
            return false;
        }
    }
    return true;
};

const planUnrestrictedMask = (
    profiles: CompiledAddonProfile[],
    baseStats: StatTuple,
    targets: StatTuple,
    balancedMask: number,
    workspace: CompiledAddonWorkspace
): UnrestrictedPlan | null => {
    const { balancedBaseStats, workingModCodes, workingTuningCodes } = workspace;
    copyTuple(baseStats, balancedBaseStats);
    workingModCodes.fill(0);
    workingTuningCodes.fill(NO_TUNING);

    let balancedCount = 0;
    for (let slotIndex = 0; slotIndex < ARMOR_SLOTS.length; slotIndex++) {
        if ((balancedMask & (1 << slotIndex)) === 0) {
            continue;
        }

        const balanced = profiles[slotIndex].balancedTuning;
        if (!balanced) {
            return null;
        }

        balancedCount += 1;
        workingTuningCodes[slotIndex] = BALANCED_TUNING;
        addAdjustmentInPlace(balancedBaseStats, balanced, 1);
    }

    return completeUnrestrictedPlan(profiles, targets, balancedCount, 0, workspace);
};

const planUnrestrictedBalancedCount = (
    profiles: CompiledAddonProfile[],
    baseStats: StatTuple,
    targets: StatTuple,
    balancedCount: number,
    balancedTuning: StatAdjustment,
    workspace: CompiledAddonWorkspace
): UnrestrictedPlan | null => {
    const { balancedBaseStats, workingModCodes, workingTuningCodes } = workspace;
    copyTuple(baseStats, balancedBaseStats);
    workingModCodes.fill(0);
    workingTuningCodes.fill(NO_TUNING);
    for (let index = 0; index < balancedCount; index++) {
        addAdjustmentInPlace(balancedBaseStats, balancedTuning, 1);
    }

    return completeUnrestrictedPlan(profiles, targets, balancedCount, balancedCount, workspace);
};

const completeUnrestrictedPlan = (
    profiles: CompiledAddonProfile[],
    targets: StatTuple,
    balancedCount: number,
    unassignedBalancedCount: number,
    workspace: CompiledAddonWorkspace
): UnrestrictedPlan | null => {
    const {
        balancedBaseStats,
        workingStats,
        workingModCodes,
        workingTuningCodes,
        workingModCounts,
        tuningDestinationSlots,
        deficitUnits,
        sourceUnits
    } = workspace;

    const pairSlotCount = ARMOR_SLOTS.length - balancedCount;
    const modCount = findRequiredAddonAllocation(
        profiles,
        balancedBaseStats,
        workingStats,
        targets,
        pairSlotCount,
        workingModCodes,
        workingTuningCodes,
        workingModCounts,
        tuningDestinationSlots,
        deficitUnits,
        sourceUnits
    );
    if (modCount < 0) {
        return null;
    }

    for (let slotIndex = 0; slotIndex < ARMOR_SLOTS.length && unassignedBalancedCount > 0; slotIndex++) {
        if (workingTuningCodes[slotIndex] === NO_TUNING) {
            workingTuningCodes[slotIndex] = BALANCED_TUNING;
            unassignedBalancedCount -= 1;
        }
    }
    if (unassignedBalancedCount > 0) {
        return null;
    }

    let tuningAssignment = 0;
    let usedPairTunings = 0;
    for (let slotIndex = 0; slotIndex < ARMOR_SLOTS.length; slotIndex++) {
        const tuningCode = workingTuningCodes[slotIndex];
        tuningAssignment = packTuningChoice(tuningAssignment, slotIndex, tuningCode);
        if (tuningCode >= STAT_TUNING_OFFSET) {
            addTupleInPlace(workingStats, profiles[slotIndex].tuningChoices[tuningCode - STAT_TUNING_OFFSET].deltas, 1);
            usedPairTunings += 1;
        }
    }

    return {
        tuningAssignment,
        modCount,
        usedTuningCount: balancedCount + usedPairTunings
    };
};

const findRequiredAddonAllocation = (
    profiles: CompiledAddonProfile[],
    balancedBaseStats: StatTuple,
    stats: StatTuple,
    targets: StatTuple,
    pairSlotCount: number,
    modCodes: Uint8Array,
    tuningCodes: Uint8Array,
    modCounts: Uint8Array,
    tuningDestinationSlots: Uint8Array,
    deficitUnits: Uint8Array,
    sourceUnits: Uint8Array
): number => {
    copyTuple(balancedBaseStats, stats);
    modCounts.fill(0);
    calculateTuningDestinationSlots(profiles, tuningCodes, tuningDestinationSlots);

    let mandatoryModCount = 0;
    for (let statIndex = 0; statIndex < ARMOR_STATS.length; statIndex++) {
        const deficitUnitsForStat = Math.max(0, Math.ceil((targets[statIndex] - stats[statIndex]) / 5));
        const tuningCapacity = Math.min(pairSlotCount, tuningDestinationSlots[statIndex]);
        const mandatoryMods = Math.max(0, Math.ceil((deficitUnitsForStat - tuningCapacity) / 2));
        modCounts[statIndex] = mandatoryMods;
        mandatoryModCount += mandatoryMods;
        stats[statIndex] += mandatoryMods * 10;
    }
    if (mandatoryModCount > ARMOR_SLOTS.length) {
        return -1;
    }

    const modCount = searchAdditionalMods(
        profiles,
        stats,
        targets,
        pairSlotCount,
        tuningCodes,
        modCounts,
        deficitUnits,
        sourceUnits,
        mandatoryModCount,
        0
    );
    if (modCount < 0) {
        return -1;
    }

    let modIndex = 0;
    for (let statIndex = 0; statIndex < ARMOR_STATS.length; statIndex++) {
        for (let index = 0; index < modCounts[statIndex]; index++) {
            modCodes[modIndex] = encodeMod(statIndex, 10);
            modIndex += 1;
        }
    }
    return modCount;
};

const calculateTuningDestinationSlots = (profiles: CompiledAddonProfile[], tuningCodes: Uint8Array, destinationSlots: Uint8Array): void => {
    destinationSlots.fill(0);
    for (let slotIndex = 0; slotIndex < ARMOR_SLOTS.length; slotIndex++) {
        if (tuningCodes[slotIndex] !== NO_TUNING) {
            continue;
        }

        let destinationMask = 0;
        for (const choice of profiles[slotIndex].tuningChoices) {
            destinationMask |= 1 << choice.positiveStatIndex;
        }
        for (let statIndex = 0; statIndex < ARMOR_STATS.length; statIndex++) {
            if ((destinationMask & (1 << statIndex)) !== 0) {
                destinationSlots[statIndex] += 1;
            }
        }
    }
};

const searchAdditionalMods = (
    profiles: CompiledAddonProfile[],
    stats: StatTuple,
    targets: StatTuple,
    pairSlotCount: number,
    tuningCodes: Uint8Array,
    modCounts: Uint8Array,
    deficitUnits: Uint8Array,
    sourceUnits: Uint8Array,
    modCount: number,
    firstModStatIndex: number
): number => {
    const requiredTransfers = calculateTransferUnits(stats, targets, deficitUnits, sourceUnits);
    resetPairTuningCodes(tuningCodes);
    if (
        requiredTransfers <= pairSlotCount &&
        sumBytes(sourceUnits) >= requiredTransfers &&
        assignRequiredTunings(profiles, deficitUnits, sourceUnits, tuningCodes)
    ) {
        return modCount;
    }

    if (modCount >= ARMOR_SLOTS.length) {
        return -1;
    }

    for (let statIndex = firstModStatIndex; statIndex < ARMOR_STATS.length; statIndex++) {
        if (stats[statIndex] >= targets[statIndex]) {
            continue;
        }

        stats[statIndex] += 10;
        modCounts[statIndex] += 1;
        const result = searchAdditionalMods(
            profiles,
            stats,
            targets,
            pairSlotCount,
            tuningCodes,
            modCounts,
            deficitUnits,
            sourceUnits,
            modCount + 1,
            statIndex
        );
        if (result >= 0) {
            return result;
        }
        modCounts[statIndex] -= 1;
        stats[statIndex] -= 10;
    }

    return -1;
};

const resetPairTuningCodes = (tuningCodes: Uint8Array): void => {
    for (let slotIndex = 0; slotIndex < tuningCodes.length; slotIndex++) {
        if (tuningCodes[slotIndex] >= STAT_TUNING_OFFSET) {
            tuningCodes[slotIndex] = NO_TUNING;
        }
    }
};

const assignRequiredTunings = (
    profiles: CompiledAddonProfile[],
    deficitUnits: Uint8Array,
    sourceUnits: Uint8Array,
    tuningCodes: Uint8Array
): boolean => {
    const destinationIndex = mostConstrainedDestination(profiles, deficitUnits, sourceUnits, tuningCodes);
    if (destinationIndex < 0) {
        return true;
    }

    for (let slotIndex = 0; slotIndex < ARMOR_SLOTS.length; slotIndex++) {
        if (tuningCodes[slotIndex] !== NO_TUNING) {
            continue;
        }

        const choices = profiles[slotIndex].tuningChoices;
        for (let choiceIndex = 0; choiceIndex < choices.length; choiceIndex++) {
            const choice = choices[choiceIndex];
            if (choice.positiveStatIndex !== destinationIndex || sourceUnits[choice.negativeStatIndex] === 0) {
                continue;
            }

            tuningCodes[slotIndex] = choiceIndex + STAT_TUNING_OFFSET;
            deficitUnits[destinationIndex] -= 1;
            sourceUnits[choice.negativeStatIndex] -= 1;
            if (assignRequiredTunings(profiles, deficitUnits, sourceUnits, tuningCodes)) {
                return true;
            }
            sourceUnits[choice.negativeStatIndex] += 1;
            deficitUnits[destinationIndex] += 1;
            tuningCodes[slotIndex] = NO_TUNING;
        }
    }

    return false;
};

const mostConstrainedDestination = (
    profiles: CompiledAddonProfile[],
    deficitUnits: Uint8Array,
    sourceUnits: Uint8Array,
    tuningCodes: Uint8Array
): number => {
    let bestIndex = -1;
    let bestChoiceCount = Number.POSITIVE_INFINITY;

    for (let destinationIndex = 0; destinationIndex < ARMOR_STATS.length; destinationIndex++) {
        if (deficitUnits[destinationIndex] === 0) {
            continue;
        }

        let choiceCount = 0;
        for (let slotIndex = 0; slotIndex < ARMOR_SLOTS.length; slotIndex++) {
            if (tuningCodes[slotIndex] !== NO_TUNING) {
                continue;
            }

            for (const choice of profiles[slotIndex].tuningChoices) {
                if (choice.positiveStatIndex === destinationIndex && sourceUnits[choice.negativeStatIndex] > 0) {
                    choiceCount += 1;
                }
            }
        }

        if (choiceCount < bestChoiceCount) {
            bestChoiceCount = choiceCount;
            bestIndex = destinationIndex;
        }
    }

    return bestIndex;
};

const calculateTransferUnits = (stats: StatTuple, targets: StatTuple, deficitUnits: Uint8Array, sourceUnits: Uint8Array): number => {
    let totalDeficitUnits = 0;
    for (let statIndex = 0; statIndex < ARMOR_STATS.length; statIndex++) {
        const difference = targets[statIndex] - stats[statIndex];
        const deficit = difference > 0 ? Math.ceil(difference / 5) : 0;
        deficitUnits[statIndex] = deficit;
        sourceUnits[statIndex] = difference < 0 ? Math.floor(-difference / 5) : 0;
        totalDeficitUnits += deficit;
    }
    return totalDeficitUnits;
};

const sumBytes = (values: Uint8Array): number => {
    let total = 0;
    for (let index = 0; index < values.length; index++) {
        total += values[index];
    }
    return total;
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
        if (!major) {
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

// Allocation caches are keyed by the exact transfer choices each selected piece supports.
const getTuningAllocations = (
    profiles: CompiledAddonProfile[],
    allowBalancedTuning: boolean,
    requireTuningWhenAvailable: boolean
): CompactTuningAllocations => {
    const key = `${allowBalancedTuning ? 'balanced' : 'pair'}:${requireTuningWhenAvailable ? 'required' : 'optional'}:${profiles
        .map((profile) => profile.signature)
        .join(',')}`;
    const cached = allocationCache.get(key);
    if (cached) {
        return cached;
    }

    let unique = new Map<number, number>([[encodeTuningDeltas(zeroTuple()), 0]]);
    const deltas = zeroTuple();

    for (let slotIndex = 0; slotIndex < ARMOR_SLOTS.length; slotIndex++) {
        const balanced = profiles[slotIndex].balancedTuning;
        const tuningChoices = profiles[slotIndex].tuningChoices;
        const next = new Map<number, number>();
        unique.forEach((packedAssignment, encodedDeltas) => {
            decodeTuningDeltaTuple(encodedDeltas, deltas);

            if (!requireTuningWhenAvailable || (tuningChoices.length === 0 && (!allowBalancedTuning || !balanced))) {
                next.set(encodedDeltas, packTuningChoice(packedAssignment, slotIndex, NO_TUNING));
            }

            for (let choiceIndex = 0; choiceIndex < tuningChoices.length; choiceIndex++) {
                const choice = tuningChoices[choiceIndex];
                addTupleInPlace(deltas, choice.deltas, 1);
                next.set(encodeTuningDeltas(deltas), packTuningChoice(packedAssignment, slotIndex, choiceIndex + STAT_TUNING_OFFSET));
                addTupleInPlace(deltas, choice.deltas, -1);
            }

            if (allowBalancedTuning && balanced) {
                addAdjustmentInPlace(deltas, balanced, 1);
                next.set(encodeTuningDeltas(deltas), packTuningChoice(packedAssignment, slotIndex, BALANCED_TUNING));
                addAdjustmentInPlace(deltas, balanced, -1);
            }
        });
        unique = next;
    }

    const assignments = new Uint32Array(unique.size);
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
        const statMod = modCode === undefined ? undefined : resolveStatMod(profile, decodeModStatIndex(modCode), decodeModValue(modCode));
        const tuningChoice = unpackTuningChoice(evaluated.tuningAssignment, slotIndex);
        const tuning =
            tuningChoice === NO_TUNING
                ? undefined
                : tuningChoice === BALANCED_TUNING
                  ? profile.balancedTuning
                  : profile.tuningChoices[tuningChoice - STAT_TUNING_OFFSET]?.adjustment;
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

const resolveStatMod = (profile: CompiledAddonProfile, statIndex: number, value: ModValue): StatAdjustment => {
    const options = profile.statMods[ARMOR_STATS[statIndex]];
    return value === 5 ? (options.minor ?? options.major) : options.major;
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

const addTupleInPlace = (tuple: StatTuple, adjustment: StatTuple, multiplier: 1 | -1): void => {
    for (let index = 0; index < ARMOR_STATS.length; index++) {
        tuple[index] += adjustment[index] * multiplier;
    }
};

const copyTuple = (source: StatTuple, target: StatTuple): void => {
    for (let index = 0; index < ARMOR_STATS.length; index++) {
        target[index] = source[index];
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

const decodeTuningDeltaTuple = (encoded: number, target: StatTuple): void => {
    for (let statIndex = ARMOR_STATS.length - 1; statIndex >= 0; statIndex--) {
        target[statIndex] = (encoded % TUNING_DELTA_BASE) - TUNING_DELTA_OFFSET;
        encoded = Math.floor(encoded / TUNING_DELTA_BASE);
    }
};

const encodeMod = (statIndex: number, value: ModValue): number => (statIndex << 1) | (value === 10 ? 1 : 0);

const decodeModStatIndex = (code: number): number => code >> 1;

const decodeModValue = (code: number): ModValue => (code & 1 ? 10 : 5);

const pairTuningIndex = (positiveStatIndex: number, negativeStatIndex: number): number =>
    positiveStatIndex * (ARMOR_STATS.length - 1) + negativeStatIndex - (negativeStatIndex > positiveStatIndex ? 1 : 0);

const adjustmentTuple = (adjustment: StatAdjustment): StatTuple => [
    adjustment.deltas.health ?? 0,
    adjustment.deltas.melee ?? 0,
    adjustment.deltas.grenade ?? 0,
    adjustment.deltas.super ?? 0,
    adjustment.deltas.class ?? 0,
    adjustment.deltas.weapons ?? 0
];

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
