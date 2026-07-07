import { addStats, emptyStats, normalizeTargets, statTotal, sumStatVectors } from './stats';
import {
    type ActiveArmorSetBonus,
    ARMOR_SLOTS,
    ARMOR_STATS,
    type ArmorBuild,
    type ArmorBuildSort,
    type ArmorInventoryBySlot,
    type ArmorItem,
    type ArmorSetRequirement,
    type ArmorSlot,
    type ArmorStat,
    type ArmorStatTargetCapsInput,
    type BuildArmorPiece,
    type DestinyClass,
    type SolveArmorInput,
    type SolveArmorResult,
    type StatAdjustment,
    type StatVector
} from './types';

const DEFAULT_MAX_RESULTS = 50;
const DEFAULT_RESULT_SORT: ArmorBuildSort = { key: 'wastedStats', direction: 'asc' };
const MAX_DISPLAY_STAT = 200;
const MAX_DP_TARGET_INDEXES = 3;
const TUNING_MODES = ['off', 'pair', 'all'] as const;
const itemMaximumStatsCache = new WeakMap<ArmorItem, Map<string, StatVector>>();
const simpleAddonCapabilityCache = new WeakMap<ArmorItem, Map<string, boolean>>();
const preparedArmorItemCache = new WeakMap<ArmorItem, Map<string, PreparedArmorItem>>();
const itemOutcomeCache = new WeakMap<ArmorItem, Map<string, StatTuple[]>>();
const adjustmentTupleCache = new WeakMap<StatAdjustment, StatTuple>();

type StatTuple = [number, number, number, number, number, number];
type TuningMode = (typeof TUNING_MODES)[number];

type PreparedArmorItem = {
    item: ArmorItem;
    base: StatTuple;
    max: StatTuple;
    simpleAddons: boolean;
};

type PreparedArmorBySlot = Record<ArmorSlot, PreparedArmorItem[]>;

type AddonChoice = {
    statMod?: StatAdjustment | undefined;
    tuning?: StatAdjustment | undefined;
    deltas: StatVector;
};

type AddonState = {
    stats: StatVector;
    choices: Record<ArmorSlot, AddonChoice>;
};

type SimpleStatModRequest = {
    stat: ArmorStat;
    value: 5 | 10;
};

type AdjustmentPreference = {
    preferPositiveGain?: boolean;
};

type CandidatePlan = {
    armor: PreparedArmorBySlot;
    suffixMaxPotential: StatTuple[];
    supportsSimpleAddons: boolean;
};

type SearchCounters = {
    searchedCombinations: number;
    rejectedCombinations: number;
    validBuildCount: number;
};

type SearchContext = {
    targets: StatVector;
    targetValues: StatTuple;
    statBonusValues: StatTuple;
    dumpStat?: ArmorStat | undefined;
    dumpStatIndex: number;
    tuningMode: TuningMode;
    maxResults: number;
    resultSort?: ArmorBuildSort | undefined;
    setRequirements: ArmorSetRequirement[];
    builds: ArmorBuild[];
    counters: SearchCounters;
    stopAfterFirstValid: boolean;
    stopWhenResultLimitReached: boolean;
    resultLimitReached: boolean;
    foundValid: boolean;
};

export function solveArmor(input: SolveArmorInput): SolveArmorResult {
    const warnings: string[] = [];
    const targets = normalizeTargets(input.statTargets);
    const statBonuses = normalizeStatBonuses(input.statBonuses);
    const dumpStatIndex = input.dumpStat ? ARMOR_STATS.indexOf(input.dumpStat) : -1;
    const tuningMode: TuningMode = input.allowBalancedTuning ? 'all' : 'pair';
    const maxResults = input.maxResults ?? DEFAULT_MAX_RESULTS;
    const plans = createCandidatePlans(input.armor, input.classType, input.selectedExoticItemHash, tuningMode, input.dumpStat);
    const missingSlot = plans.every((plan) => ARMOR_SLOTS.some((slot) => plan.armor[slot].length === 0));

    if (missingSlot) {
        return {
            ok: false,
            reason: 'No compatible armor found for every armor slot.',
            validBuildCount: 0,
            returnedBuildCount: 0,
            resultLimitReached: false,
            searchedCombinations: 0,
            rejectedCombinations: 0,
            warnings
        };
    }

    const targetIndexes = targetIndexesForTargets(toStatTuple(targets), dumpStatIndex);
    if (
        input.setRequirements.length === 0 &&
        canUseDpForTargetIndexes(targetIndexes) &&
        !canReachPreparedArmorStatTargetsByDp(plans, targets, statBonuses, dumpStatIndex, tuningMode, input.dumpStat)
    ) {
        return {
            ok: false,
            reason: 'No build matched the selected targets and constraints.',
            validBuildCount: 0,
            returnedBuildCount: 0,
            resultLimitReached: false,
            searchedCombinations: 0,
            rejectedCombinations: 0,
            warnings
        };
    }

    const builds: ArmorBuild[] = [];
    const counters = {
        searchedCombinations: 0,
        rejectedCombinations: 0,
        validBuildCount: 0
    };
    const context: SearchContext = {
        targets,
        targetValues: toStatTuple(targets),
        statBonusValues: toStatTuple(statBonuses),
        dumpStat: input.dumpStat,
        dumpStatIndex,
        tuningMode,
        maxResults,
        resultSort: input.resultSort,
        setRequirements: input.setRequirements,
        builds,
        counters,
        stopAfterFirstValid: false,
        stopWhenResultLimitReached: input.stopWhenResultLimitReached === true && input.resultSort === undefined,
        resultLimitReached: false,
        foundValid: false
    };

    for (const plan of plans) {
        if (context.resultLimitReached || ARMOR_SLOTS.some((slot) => plan.armor[slot].length === 0)) {
            continue;
        }

        searchPlan(prioritizePlanForTargets(plan, context.targetValues, dumpStatIndex, input.setRequirements), context);
    }

    builds.sort((left, right) => compareBuilds(left, right, input.resultSort ?? DEFAULT_RESULT_SORT));

    if (counters.validBuildCount === 0) {
        return {
            ok: false,
            reason: 'No build matched the selected targets and constraints.',
            validBuildCount: 0,
            returnedBuildCount: 0,
            resultLimitReached: false,
            searchedCombinations: counters.searchedCombinations,
            rejectedCombinations: counters.rejectedCombinations,
            warnings
        };
    }

    return {
        ok: true,
        builds,
        validBuildCount: counters.validBuildCount,
        returnedBuildCount: builds.length,
        resultLimitReached: context.resultLimitReached || counters.validBuildCount > builds.length,
        searchedCombinations: counters.searchedCombinations,
        rejectedCombinations: counters.rejectedCombinations,
        warnings
    };
}

export function calculateArmorStatTargetCaps(input: ArmorStatTargetCapsInput): StatVector {
    const caps = emptyStats();

    for (const stat of ARMOR_STATS) {
        caps[stat] = calculateArmorStatTargetCap(input, stat);
    }

    return caps;
}

export function calculateArmorStatTargetCap(input: ArmorStatTargetCapsInput, stat: ArmorStat): number {
    if (stat === input.dumpStat) {
        return 0;
    }

    const baseTargets = normalizeTargets(input.statTargets);
    const statBonuses = normalizeStatBonuses(input.statBonuses);
    const dumpStatIndex = input.dumpStat ? ARMOR_STATS.indexOf(input.dumpStat) : -1;
    const tuningMode: TuningMode = input.allowBalancedTuning ? 'all' : 'pair';
    const plans = createCandidatePlans(input.armor, input.classType, input.selectedExoticItemHash, tuningMode, input.dumpStat);

    if (plans.every((plan) => ARMOR_SLOTS.some((slot) => plan.armor[slot].length === 0))) {
        return 0;
    }

    if (input.dumpStat) {
        baseTargets[input.dumpStat] = 0;
    }

    const capTargetIndexes = targetIndexesForTargets(toStatTuple(baseTargets), dumpStatIndex, ARMOR_STATS.indexOf(stat));
    if (input.setRequirements.length === 0 && canUseDpForTargetIndexes(capTargetIndexes)) {
        const optimisticCap = calculatePreparedArmorStatTargetCapByDp(
            plans,
            baseTargets,
            statBonuses,
            ARMOR_STATS.indexOf(stat),
            dumpStatIndex,
            tuningMode,
            input.dumpStat
        );

        return verifyTargetCapWithSolver(input, baseTargets, stat, optimisticCap);
    }

    const maxTargetResult = solveArmor({
        ...input,
        statTargets: {
            ...baseTargets,
            [stat]: 200
        },
        maxResults: 1,
        stopWhenResultLimitReached: true
    });

    if (maxTargetResult.ok) {
        return Math.min(200, maxTargetResult.builds[0]?.stats[stat] ?? 200);
    }

    const bestTarget = calculatePreparedArmorStatTargetCap(
        plans,
        baseTargets,
        statBonuses,
        stat,
        input.dumpStat,
        dumpStatIndex,
        tuningMode,
        input.setRequirements
    );
    const statTargets = {
        ...baseTargets,
        [stat]: bestTarget
    };
    const result = solveArmor({
        ...input,
        statTargets,
        maxResults: 1
    });

    if (!result.ok) {
        return 0;
    }

    return result.builds[0]?.stats[stat] ?? 0;
}

function verifyTargetCapWithSolver(input: ArmorStatTargetCapsInput, baseTargets: StatVector, stat: ArmorStat, optimisticCap: number) {
    const step = input.allowBalancedTuning ? 1 : 5;
    const firstCandidate = Math.floor(Math.min(MAX_DISPLAY_STAT, optimisticCap) / step) * step;

    for (let target = firstCandidate; target >= 0; target -= step) {
        const result = solveArmor({
            ...input,
            statTargets: {
                ...baseTargets,
                [stat]: target
            },
            maxResults: 1,
            stopWhenResultLimitReached: true
        });

        if (!result.ok) {
            continue;
        }

        const displayedStat = Math.min(MAX_DISPLAY_STAT, result.builds[0]?.stats[stat] ?? target);
        if (displayedStat <= target) {
            return target;
        }

        const displayedStatResult = solveArmor({
            ...input,
            statTargets: {
                ...baseTargets,
                [stat]: displayedStat
            },
            maxResults: 1,
            stopWhenResultLimitReached: true
        });

        return displayedStatResult.ok ? displayedStat : target;
    }

    return 0;
}

function calculatePreparedArmorStatTargetCap(
    plans: CandidatePlan[],
    baseTargets: StatVector,
    statBonuses: StatVector,
    stat: ArmorStat,
    dumpStat: ArmorStat | undefined,
    dumpStatIndex: number,
    tuningMode: TuningMode,
    setRequirements: ArmorSetRequirement[]
) {
    let low = 0;
    let high = 200;
    let best = 0;

    while (low <= high) {
        const midpoint = Math.floor((low + high) / 2);
        const targets = {
            ...baseTargets,
            [stat]: midpoint
        };

        if (canReachPreparedArmorStatTargets(plans, targets, statBonuses, dumpStat, dumpStatIndex, tuningMode, setRequirements)) {
            best = midpoint;
            low = midpoint + 1;
        } else {
            high = midpoint - 1;
        }
    }

    return best;
}

export function canReachArmorStatTargets(input: ArmorStatTargetCapsInput) {
    const targets = normalizeTargets(input.statTargets);
    const statBonuses = normalizeStatBonuses(input.statBonuses);
    const dumpStatIndex = input.dumpStat ? ARMOR_STATS.indexOf(input.dumpStat) : -1;
    const tuningMode: TuningMode = input.allowBalancedTuning ? 'all' : 'pair';
    const plans = createCandidatePlans(input.armor, input.classType, input.selectedExoticItemHash, tuningMode, input.dumpStat);
    const missingSlot = plans.every((plan) => ARMOR_SLOTS.some((slot) => plan.armor[slot].length === 0));

    if (missingSlot) {
        return false;
    }

    return canReachPreparedArmorStatTargets(plans, targets, statBonuses, input.dumpStat, dumpStatIndex, tuningMode, input.setRequirements);
}

function canReachPreparedArmorStatTargets(
    plans: CandidatePlan[],
    targets: StatVector,
    statBonuses: StatVector,
    dumpStat: ArmorStat | undefined,
    dumpStatIndex: number,
    tuningMode: TuningMode,
    setRequirements: ArmorSetRequirement[]
) {
    const targetIndexes = targetIndexesForTargets(toStatTuple(targets), dumpStatIndex);
    if (setRequirements.length === 0 && canUseDpForTargetIndexes(targetIndexes)) {
        return canReachPreparedArmorStatTargetsByDp(plans, targets, statBonuses, dumpStatIndex, tuningMode, dumpStat);
    }

    const context: SearchContext = {
        targets,
        targetValues: toStatTuple(targets),
        statBonusValues: toStatTuple(statBonuses),
        dumpStat,
        dumpStatIndex,
        tuningMode,
        maxResults: 0,
        resultSort: undefined,
        setRequirements,
        builds: [],
        counters: {
            searchedCombinations: 0,
            rejectedCombinations: 0,
            validBuildCount: 0
        },
        stopAfterFirstValid: true,
        stopWhenResultLimitReached: false,
        resultLimitReached: false,
        foundValid: false
    };

    for (const plan of plans) {
        if (ARMOR_SLOTS.some((slot) => plan.armor[slot].length === 0)) {
            continue;
        }

        searchPlan(prioritizePlanForTargets(plan, context.targetValues, dumpStatIndex, setRequirements), context);

        if (context.foundValid) {
            return true;
        }
    }

    return false;
}

function canReachPreparedArmorStatTargetsByDp(
    plans: CandidatePlan[],
    targets: StatVector,
    statBonuses: StatVector,
    dumpStatIndex: number,
    tuningMode: TuningMode,
    dumpStat: ArmorStat | undefined
) {
    const targetValues = toStatTuple(targets);
    const targetIndexes = targetIndexesForTargets(targetValues, dumpStatIndex);

    if (targetIndexes.length === 0) {
        return true;
    }

    for (const plan of plans) {
        if (ARMOR_SLOTS.some((slot) => plan.armor[slot].length === 0)) {
            continue;
        }

        let states: StatTuple[] = [capTupleToTargets(toStatTuple(statBonuses), targetValues, targetIndexes)];

        for (const slot of ARMOR_SLOTS) {
            const nextStates: StatTuple[] = [];

            for (const state of states) {
                for (const item of plan.armor[slot]) {
                    for (const outcome of itemOutcomeTuples(item.item, tuningMode, dumpStat)) {
                        const nextState = capTupleToTargets(addTuples(state, outcome), targetValues, targetIndexes);
                        if (tupleMeetsTargetIndexes(nextState, targetValues, targetIndexes)) {
                            return true;
                        }

                        nextStates.push(nextState);
                    }
                }
            }

            states = pruneDominatedTargetStates(nextStates, targetIndexes);
            if (states.length === 0) {
                break;
            }
        }
    }

    return false;
}

function calculatePreparedArmorStatTargetCapByDp(
    plans: CandidatePlan[],
    targets: StatVector,
    statBonuses: StatVector,
    statIndex: number,
    dumpStatIndex: number,
    tuningMode: TuningMode,
    dumpStat: ArmorStat | undefined
) {
    if (statIndex === dumpStatIndex) {
        return 0;
    }

    const targetValues = toStatTuple(targets);
    const targetIndexes = targetValues
        .map((target, index) => ({ index, target }))
        .filter(({ index, target }) => index !== dumpStatIndex && index !== statIndex && target > 0)
        .map(({ index }) => index);
    const scoreIndexes = [...targetIndexes, statIndex];
    let best = 0;

    for (const plan of plans) {
        if (ARMOR_SLOTS.some((slot) => plan.armor[slot].length === 0)) {
            continue;
        }

        let states: StatTuple[] = [capTupleForCapSearch(toStatTuple(statBonuses), targetValues, targetIndexes, statIndex)];

        for (const slot of ARMOR_SLOTS) {
            const nextStates: StatTuple[] = [];

            for (const state of states) {
                for (const item of plan.armor[slot]) {
                    for (const outcome of itemOutcomeTuples(item.item, tuningMode, dumpStat)) {
                        const nextState = capTupleForCapSearch(addTuples(state, outcome), targetValues, targetIndexes, statIndex);
                        if (tupleMeetsTargetIndexes(nextState, targetValues, targetIndexes)) {
                            best = Math.max(best, nextState[statIndex]);
                            if (best >= MAX_DISPLAY_STAT) {
                                return MAX_DISPLAY_STAT;
                            }
                        }

                        nextStates.push(nextState);
                    }
                }
            }

            states = pruneDominatedTargetStates(nextStates, scoreIndexes);
            if (states.length === 0) {
                break;
            }
        }
    }

    return best;
}

function targetIndexesForTargets(targetValues: StatTuple, dumpStatIndex: number, excludedIndex = -1) {
    return targetValues
        .map((target, index) => ({ index, target }))
        .filter(({ index, target }) => index !== dumpStatIndex && index !== excludedIndex && target > 0)
        .map(({ index }) => index);
}

function canUseDpForTargetIndexes(targetIndexes: number[]) {
    return targetIndexes.length <= MAX_DP_TARGET_INDEXES;
}

function createCandidatePlans(
    armor: ArmorInventoryBySlot,
    classType: DestinyClass,
    selectedExoticItemHash: number | undefined,
    tuningMode: TuningMode,
    dumpStat: ArmorStat | undefined
): CandidatePlan[] {
    const compatible = {} as PreparedArmorBySlot;

    for (const slot of ARMOR_SLOTS) {
        compatible[slot] = armor[slot]
            .filter((item) => item.classType === 'any' || item.classType === classType)
            .map((item) => prepareArmorItem(item, tuningMode, dumpStat));
    }

    const legendaryOnly = {} as PreparedArmorBySlot;
    for (const slot of ARMOR_SLOTS) {
        legendaryOnly[slot] = compatible[slot].filter((item) => !item.item.isExotic);
    }

    if (!selectedExoticItemHash) {
        return [createCandidatePlan(legendaryOnly)];
    }

    const plans: CandidatePlan[] = [];

    for (const exoticSlot of ARMOR_SLOTS) {
        const exoticCandidates = compatible[exoticSlot].filter(
            (item) => item.item.isExotic && item.item.itemHash === selectedExoticItemHash
        );

        if (exoticCandidates.length === 0) {
            continue;
        }

        const planArmor = { ...legendaryOnly, [exoticSlot]: exoticCandidates } as PreparedArmorBySlot;
        plans.push(createCandidatePlan(planArmor));
    }

    return plans;
}

function createCandidatePlan(armor: PreparedArmorBySlot): CandidatePlan {
    return {
        armor,
        suffixMaxPotential: createSuffixMaxPotential(armor),
        supportsSimpleAddons: armorSupportsSimpleAddons(armor)
    };
}

function prioritizePlanForTargets(
    plan: CandidatePlan,
    targetValues: StatTuple,
    dumpStatIndex: number,
    setRequirements: ArmorSetRequirement[]
): CandidatePlan {
    const requiredSetIds = new Set(setRequirements.map((requirement) => requirement.setId));
    const armor = {} as PreparedArmorBySlot;

    for (const slot of ARMOR_SLOTS) {
        armor[slot] = [...plan.armor[slot]].sort(
            (left, right) =>
                targetPriorityScore(right, targetValues, dumpStatIndex, requiredSetIds) -
                    targetPriorityScore(left, targetValues, dumpStatIndex, requiredSetIds) || comparePreparedArmorIds(left, right)
        );
    }

    return {
        ...plan,
        armor
    };
}

function targetPriorityScore(item: PreparedArmorItem, targetValues: StatTuple, dumpStatIndex: number, requiredSetIds: Set<string>) {
    let score = 0;

    for (let index = 0; index < ARMOR_STATS.length; index++) {
        if (index === dumpStatIndex) {
            continue;
        }

        const target = targetValues[index];
        const weight = target > 0 ? 8 : 1;
        score += Math.min(item.max[index], Math.max(target, 25)) * weight;
    }

    if (item.item.set && requiredSetIds.has(item.item.set.id)) {
        score += 10_000;
    }

    return score;
}

function comparePreparedArmorIds(left: PreparedArmorItem, right: PreparedArmorItem) {
    return left.item.itemInstanceId.localeCompare(right.item.itemInstanceId);
}

function prepareArmorItem(item: ArmorItem, tuningMode: TuningMode, dumpStat: ArmorStat | undefined): PreparedArmorItem {
    const cache = getItemCache(preparedArmorItemCache, item);
    const key = tuningCacheKey(tuningMode, dumpStat);
    const cached = cache.get(key);

    if (cached) {
        return cached;
    }

    const prepared = {
        item,
        base: toStatTuple(item.baseStats),
        max: toStatTuple(itemMaximumStats(item, tuningMode, dumpStat)),
        simpleAddons: hasSimpleStatModsAndNoTuning(item, tuningMode, dumpStat)
    };

    cache.set(key, prepared);
    return prepared;
}

function searchPlan(plan: CandidatePlan, context: SearchContext) {
    const selectedPieces = {} as Partial<Record<ArmorSlot, PreparedArmorItem>>;
    const selectedList: PreparedArmorItem[] = [];

    searchSlot(plan, context, selectedPieces, selectedList, 0, [...context.statBonusValues], [...context.statBonusValues]);
}

function searchSlot(
    plan: CandidatePlan,
    context: SearchContext,
    selectedPieces: Partial<Record<ArmorSlot, PreparedArmorItem>>,
    selectedList: PreparedArmorItem[],
    slotIndex: number,
    baseStats: StatTuple,
    potentialStats: StatTuple
) {
    if ((context.stopAfterFirstValid && context.foundValid) || context.resultLimitReached) {
        return;
    }

    if (!canStillReachTargets(potentialStats, plan.suffixMaxPotential[slotIndex], context.targetValues, context.dumpStatIndex)) {
        context.counters.rejectedCombinations += productRemainingSlots(plan.armor, slotIndex);
        return;
    }

    if (!canStillMeetSetRequirements(selectedList, plan.armor, slotIndex, context.setRequirements)) {
        context.counters.rejectedCombinations += productRemainingSlots(plan.armor, slotIndex);
        return;
    }

    if (slotIndex >= ARMOR_SLOTS.length) {
        context.counters.searchedCombinations += 1;

        if (!satisfiesSetRequirements(selectedList, context.setRequirements)) {
            context.counters.rejectedCombinations += 1;
            return;
        }

        const pieces = selectedPieces as Record<ArmorSlot, PreparedArmorItem>;
        const shouldRetainBuild = context.resultSort !== undefined || context.builds.length < context.maxResults;
        const bestAddonState = evaluateAddonState(
            pieces,
            baseStats,
            context.targets,
            context.targetValues,
            context.dumpStat,
            context.dumpStatIndex,
            context.tuningMode,
            shouldRetainBuild,
            plan.supportsSimpleAddons
        );

        if (!bestAddonState.valid) {
            context.counters.rejectedCombinations += 1;
            return;
        }

        context.counters.validBuildCount += 1;
        context.foundValid = true;

        if (shouldRetainBuild && bestAddonState.state) {
            retainBuild(context, createBuild(unpreparePieces(pieces), bestAddonState.state, context.targets, context.dumpStat));
        }
        if (context.stopWhenResultLimitReached && context.counters.validBuildCount >= context.maxResults) {
            context.resultLimitReached = true;
        }
        return;
    }

    const slot = ARMOR_SLOTS[slotIndex];

    for (const item of plan.armor[slot]) {
        selectedPieces[slot] = item;
        selectedList.push(item);
        addTupleInPlace(baseStats, item.base, 1);
        addTupleInPlace(potentialStats, item.max, 1);

        searchSlot(plan, context, selectedPieces, selectedList, slotIndex + 1, baseStats, potentialStats);

        if ((context.stopAfterFirstValid && context.foundValid) || context.resultLimitReached) {
            addTupleInPlace(baseStats, item.base, -1);
            addTupleInPlace(potentialStats, item.max, -1);
            selectedList.pop();
            delete selectedPieces[slot];
            return;
        }

        addTupleInPlace(baseStats, item.base, -1);
        addTupleInPlace(potentialStats, item.max, -1);
        selectedList.pop();
        delete selectedPieces[slot];
    }
}

function evaluateAddonState(
    pieces: Record<ArmorSlot, PreparedArmorItem>,
    baseStats: StatTuple,
    targets: StatVector,
    targetValues: StatTuple,
    dumpStat: ArmorStat | undefined,
    dumpStatIndex: number,
    tuningMode: TuningMode,
    retainState: boolean,
    supportsSimpleAddons: boolean
) {
    if (supportsSimpleAddons) {
        return evaluateSimpleStatMods(pieces, baseStats, targetValues, dumpStatIndex, retainState);
    }

    if (tupleMeetsTargets(baseStats, targetValues, dumpStatIndex)) {
        return {
            valid: true,
            state: retainState ? createEmptyAddonState(tupleToStats(baseStats)) : null
        };
    }

    if (!retainState) {
        return {
            valid: canMeetTargetsWithAddonTuples(pieces, baseStats, targetValues, dumpStatIndex, tuningMode, dumpStat),
            state: null
        };
    }

    const state = findBestAddonState(unpreparePieces(pieces), tupleToStats(baseStats), targets, dumpStat, tuningMode);

    return {
        valid: state !== null,
        state
    };
}

function armorSupportsSimpleAddons(armor: PreparedArmorBySlot) {
    for (const slot of ARMOR_SLOTS) {
        if (!armor[slot].every((item) => item.simpleAddons)) {
            return false;
        }
    }

    return true;
}

function evaluateSimpleStatMods(
    pieces: Record<ArmorSlot, PreparedArmorItem>,
    baseStats: StatTuple,
    targetValues: StatTuple,
    dumpStatIndex: number,
    retainState: boolean
) {
    const modRequests: SimpleStatModRequest[] = [];
    const projectedStats = [...baseStats] as StatTuple;

    for (let index = 0; index < ARMOR_STATS.length; index++) {
        if (index === dumpStatIndex) {
            continue;
        }

        const deficit = targetValues[index] - baseStats[index];

        if (deficit > 0) {
            let remaining = deficit;
            while (remaining > 0) {
                const value = projectedStats[index] + 10 <= MAX_DISPLAY_STAT ? 10 : 5;
                if (projectedStats[index] + value > MAX_DISPLAY_STAT) {
                    return {
                        valid: false,
                        state: null
                    };
                }

                modRequests.push({ stat: ARMOR_STATS[index], value });
                projectedStats[index] += value;
                remaining -= value;
            }
        }
    }

    if (modRequests.length > ARMOR_SLOTS.length) {
        return {
            valid: false,
            state: null
        };
    }

    if (!retainState) {
        return {
            valid: true,
            state: null
        };
    }

    const stats = tupleToStats(baseStats);
    const choices = {} as Record<ArmorSlot, AddonChoice>;
    const modQueue = [...modRequests];

    for (const slot of ARMOR_SLOTS) {
        const modRequest = modQueue.shift();
        const statMod = getSimpleStatModOption(pieces[slot].item, modRequest);
        const deltas = statMod?.deltas ?? {};

        stats.health += deltas.health ?? 0;
        stats.melee += deltas.melee ?? 0;
        stats.grenade += deltas.grenade ?? 0;
        stats.super += deltas.super ?? 0;
        stats.class += deltas.class ?? 0;
        stats.weapons += deltas.weapons ?? 0;

        choices[slot] = {
            statMod,
            deltas: statMod ? addStats(emptyStats(), statMod.deltas) : emptyStats()
        };
    }

    return {
        valid: true,
        state: {
            stats,
            choices
        }
    };
}

function getSimpleStatModOption(item: ArmorItem, request?: SimpleStatModRequest) {
    if (!request) {
        return item.statModOptions.find((option) => isZeroAdjustment(option));
    }

    return item.statModOptions.find((option) => option.deltas[request.stat] === request.value && adjustmentTotal(option) === request.value);
}

function canMeetTargetsWithAddonTuples(
    pieces: Record<ArmorSlot, PreparedArmorItem>,
    baseStats: StatTuple,
    targetValues: StatTuple,
    dumpStatIndex: number,
    tuningMode: TuningMode,
    dumpStat: ArmorStat | undefined
) {
    const stats = [...baseStats] as StatTuple;

    for (const slot of ARMOR_SLOTS) {
        const piece = pieces[slot].item;
        const statMod = chooseBestAdjustmentForTuple(piece.statModOptions, stats, targetValues, dumpStatIndex, {
            preferPositiveGain: true
        });

        addAdjustmentTupleInPlace(stats, statMod);

        const tuning =
            tuningMode === 'off'
                ? undefined
                : chooseBestAdjustmentForTuple(tuningOptionsForMode(piece, tuningMode, dumpStat), stats, targetValues, dumpStatIndex);

        addAdjustmentTupleInPlace(stats, tuning);
    }

    return tupleMeetsTargets(stats, targetValues, dumpStatIndex);
}

function chooseBestAdjustmentForTuple(
    options: StatAdjustment[],
    stats: StatTuple,
    targets: StatTuple,
    dumpStatIndex: number,
    preference: AdjustmentPreference = {}
) {
    const noChange = options.find((option) => adjustmentTupleTotal(option) === 0);
    let best = noChange;
    let bestScore = 0;
    let bestDumpRelief = best ? dumpStatReliefByIndex(best, dumpStatIndex) : 0;
    let bestOverflow = best ? tupleOverflowAmount(addAdjustmentToTuple(stats, best)) : 0;
    let bestGain = best ? positiveAdjustmentTotal(best) : 0;

    for (const option of options) {
        const nextStats = addAdjustmentToTuple(stats, option);
        const score = tupleTotalDeficit(stats, targets, dumpStatIndex) - tupleTotalDeficit(nextStats, targets, dumpStatIndex);
        const relief = dumpStatReliefByIndex(option, dumpStatIndex);
        const overflow = tupleOverflowAmount(nextStats);
        const gain = positiveAdjustmentTotal(option);
        const hasUsefulEffect = score > 0 || relief > 0;

        if (
            overflow < bestOverflow ||
            (overflow === bestOverflow && score > bestScore) ||
            (overflow === bestOverflow && score === bestScore && relief > bestDumpRelief) ||
            (preference.preferPositiveGain &&
                overflow === bestOverflow &&
                score === bestScore &&
                relief === bestDumpRelief &&
                gain > bestGain) ||
            (hasUsefulEffect &&
                overflow === bestOverflow &&
                score === bestScore &&
                relief === bestDumpRelief &&
                gain === bestGain &&
                best &&
                option.id.localeCompare(best.id) < 0)
        ) {
            best = option;
            bestScore = score;
            bestDumpRelief = relief;
            bestOverflow = overflow;
            bestGain = gain;
        }
    }

    return best;
}

function addAdjustmentToTuple(stats: StatTuple, adjustment: StatAdjustment): StatTuple {
    const deltas = adjustmentTuple(adjustment);
    return [
        stats[0] + deltas[0],
        stats[1] + deltas[1],
        stats[2] + deltas[2],
        stats[3] + deltas[3],
        stats[4] + deltas[4],
        stats[5] + deltas[5]
    ];
}

function addAdjustmentTupleInPlace(stats: StatTuple, adjustment: StatAdjustment | undefined) {
    if (!adjustment) {
        return;
    }

    const deltas = adjustmentTuple(adjustment);
    stats[0] += deltas[0];
    stats[1] += deltas[1];
    stats[2] += deltas[2];
    stats[3] += deltas[3];
    stats[4] += deltas[4];
    stats[5] += deltas[5];
}

function adjustmentTuple(adjustment: StatAdjustment): StatTuple {
    const cached = adjustmentTupleCache.get(adjustment);

    if (cached) {
        return cached;
    }

    const tuple: StatTuple = [
        adjustment.deltas.health ?? 0,
        adjustment.deltas.melee ?? 0,
        adjustment.deltas.grenade ?? 0,
        adjustment.deltas.super ?? 0,
        adjustment.deltas.class ?? 0,
        adjustment.deltas.weapons ?? 0
    ];

    adjustmentTupleCache.set(adjustment, tuple);
    return tuple;
}

function adjustmentTupleTotal(adjustment: StatAdjustment) {
    const tuple = adjustmentTuple(adjustment);
    return tuple[0] + tuple[1] + tuple[2] + tuple[3] + tuple[4] + tuple[5];
}

function tupleOverflowAmount(stats: StatTuple) {
    return (
        Math.max(0, stats[0] - MAX_DISPLAY_STAT) +
        Math.max(0, stats[1] - MAX_DISPLAY_STAT) +
        Math.max(0, stats[2] - MAX_DISPLAY_STAT) +
        Math.max(0, stats[3] - MAX_DISPLAY_STAT) +
        Math.max(0, stats[4] - MAX_DISPLAY_STAT) +
        Math.max(0, stats[5] - MAX_DISPLAY_STAT)
    );
}

function tupleTotalDeficit(stats: StatTuple, targets: StatTuple, dumpStatIndex: number) {
    return (
        (dumpStatIndex === 0 ? 0 : Math.max(0, targets[0] - stats[0])) +
        (dumpStatIndex === 1 ? 0 : Math.max(0, targets[1] - stats[1])) +
        (dumpStatIndex === 2 ? 0 : Math.max(0, targets[2] - stats[2])) +
        (dumpStatIndex === 3 ? 0 : Math.max(0, targets[3] - stats[3])) +
        (dumpStatIndex === 4 ? 0 : Math.max(0, targets[4] - stats[4])) +
        (dumpStatIndex === 5 ? 0 : Math.max(0, targets[5] - stats[5]))
    );
}

function dumpStatReliefByIndex(adjustment: StatAdjustment, dumpStatIndex: number) {
    if (dumpStatIndex < 0) {
        return 0;
    }

    return Math.max(0, -adjustmentTuple(adjustment)[dumpStatIndex]);
}

function zeroTuple(): StatTuple {
    return [0, 0, 0, 0, 0, 0];
}

function toStatTuple(stats: StatVector): StatTuple {
    return [stats.health, stats.melee, stats.grenade, stats.super, stats.class, stats.weapons];
}

function tupleToStats(stats: StatTuple): StatVector {
    return {
        health: stats[0],
        melee: stats[1],
        grenade: stats[2],
        super: stats[3],
        class: stats[4],
        weapons: stats[5]
    };
}

function normalizeStatBonuses(statBonuses: Partial<StatVector> | undefined): StatVector {
    const normalized = emptyStats();

    if (!statBonuses) {
        return normalized;
    }

    for (const stat of ARMOR_STATS) {
        const value = statBonuses[stat] ?? 0;
        normalized[stat] = Number.isFinite(value) ? Math.trunc(value) : 0;
    }

    return normalized;
}

function addTupleInPlace(left: StatTuple, right: StatTuple, multiplier: 1 | -1) {
    left[0] += right[0] * multiplier;
    left[1] += right[1] * multiplier;
    left[2] += right[2] * multiplier;
    left[3] += right[3] * multiplier;
    left[4] += right[4] * multiplier;
    left[5] += right[5] * multiplier;
}

function tupleMeetsTargets(stats: StatTuple, targets: StatTuple, dumpStatIndex: number) {
    return (
        (dumpStatIndex === 0 || stats[0] >= targets[0]) &&
        (dumpStatIndex === 1 || stats[1] >= targets[1]) &&
        (dumpStatIndex === 2 || stats[2] >= targets[2]) &&
        (dumpStatIndex === 3 || stats[3] >= targets[3]) &&
        (dumpStatIndex === 4 || stats[4] >= targets[4]) &&
        (dumpStatIndex === 5 || stats[5] >= targets[5])
    );
}

function unpreparePieces(pieces: Record<ArmorSlot, PreparedArmorItem>): Record<ArmorSlot, ArmorItem> {
    return {
        helmet: pieces.helmet.item,
        arms: pieces.arms.item,
        chest: pieces.chest.item,
        legs: pieces.legs.item,
        classItem: pieces.classItem.item
    };
}

function hasSimpleStatModsAndNoTuning(item: ArmorItem, tuningMode: TuningMode, dumpStat: ArmorStat | undefined) {
    const cache = getItemCache(simpleAddonCapabilityCache, item);
    const key = tuningCacheKey(tuningMode, dumpStat);
    const cached = cache.get(key);

    if (cached !== undefined) {
        return cached;
    }

    const hasOnlyNoTuning =
        tuningMode === 'off' || tuningOptionsForMode(item, tuningMode, dumpStat).every((option) => isZeroAdjustment(option));
    const hasNoMod = item.statModOptions.some((option) => isZeroAdjustment(option));
    const hasEveryStatMod = ARMOR_STATS.every((stat) =>
        ([5, 10] as const).every((value) =>
            item.statModOptions.some((option) => option.deltas[stat] === value && adjustmentTotal(option) === value)
        )
    );
    const isSimple = hasOnlyNoTuning && hasNoMod && hasEveryStatMod;

    cache.set(key, isSimple);
    return isSimple;
}

function isZeroAdjustment(adjustment: StatAdjustment) {
    return ARMOR_STATS.every((stat) => (adjustment.deltas[stat] ?? 0) === 0);
}

function tuningOptionsForMode(item: Pick<ArmorItem, 'tuningOptions'>, tuningMode: TuningMode, dumpStat: ArmorStat | undefined) {
    if (tuningMode === 'off') {
        return [];
    }

    if (tuningMode === 'all') {
        return item.tuningOptions;
    }

    return item.tuningOptions.filter(
        (option) => isNoTuningAdjustment(option) || (dumpStat ? subtractsOnlyDumpStat(option, dumpStat) : isPairTuningAdjustment(option))
    );
}

function isNoTuningAdjustment(adjustment: StatAdjustment) {
    return adjustment.id === 'tuning:none' || (adjustment.name.toLowerCase() === 'no tuning' && isZeroAdjustment(adjustment));
}

function isBalancedTuningAdjustment(adjustment: StatAdjustment) {
    const values = ARMOR_STATS.map((stat) => adjustment.deltas[stat] ?? 0);
    const positiveOnes = values.filter((value) => value === 1).length;
    const otherNonZero = values.some((value) => value !== 0 && value !== 1);

    return positiveOnes === 3 && !otherNonZero;
}

function subtractsOnlyDumpStat(adjustment: StatAdjustment, dumpStat: ArmorStat) {
    const negativeStats = ARMOR_STATS.filter((stat) => (adjustment.deltas[stat] ?? 0) < 0);
    const hasPositiveStat = ARMOR_STATS.some((stat) => (adjustment.deltas[stat] ?? 0) > 0);

    return hasPositiveStat && negativeStats.length === 1 && negativeStats[0] === dumpStat && !isBalancedTuningAdjustment(adjustment);
}

function isPairTuningAdjustment(adjustment: StatAdjustment) {
    const negativeStats = ARMOR_STATS.filter((stat) => (adjustment.deltas[stat] ?? 0) < 0);
    const positiveStats = ARMOR_STATS.filter((stat) => (adjustment.deltas[stat] ?? 0) > 0);

    return positiveStats.length === 1 && negativeStats.length === 1 && !isBalancedTuningAdjustment(adjustment);
}

function tuningCacheKey(tuningMode: TuningMode, dumpStat: ArmorStat | undefined) {
    return `${tuningMode}:${dumpStat ?? 'none'}`;
}

function getItemCache<T>(cache: WeakMap<ArmorItem, Map<string, T>>, item: ArmorItem) {
    let itemCache = cache.get(item);
    if (!itemCache) {
        itemCache = new Map();
        cache.set(item, itemCache);
    }

    return itemCache;
}

function adjustmentTotal(adjustment: StatAdjustment) {
    return ARMOR_STATS.reduce((total, stat) => total + (adjustment.deltas[stat] ?? 0), 0);
}

function createEmptyAddonState(stats: StatVector): AddonState {
    return {
        stats,
        choices: Object.fromEntries(
            ARMOR_SLOTS.map((slot) => [
                slot,
                {
                    deltas: emptyStats()
                }
            ])
        ) as Record<ArmorSlot, AddonChoice>
    };
}

function satisfiesSetRequirements(pieces: PreparedArmorItem[], requirements: ArmorSetRequirement[]) {
    if (requirements.length === 0) {
        return true;
    }

    const counts = countSets(pieces);
    return requirements.every((requirement) => (counts.get(requirement.setId) ?? 0) >= requirement.requiredPieces);
}

function countSets(pieces: PreparedArmorItem[]) {
    const counts = new Map<string, number>();

    for (const piece of pieces) {
        if (piece.item.set) {
            counts.set(piece.item.set.id, (counts.get(piece.item.set.id) ?? 0) + 1);
        }
    }

    return counts;
}

function canStillMeetSetRequirements(
    selectedPieces: PreparedArmorItem[],
    remainingArmor: PreparedArmorBySlot,
    nextSlotIndex: number,
    requirements: ArmorSetRequirement[]
) {
    if (requirements.length === 0) {
        return true;
    }

    const selectedCounts = countSets(selectedPieces);

    return requirements.every((requirement) => {
        let possible = selectedCounts.get(requirement.setId) ?? 0;

        for (let index = nextSlotIndex; index < ARMOR_SLOTS.length; index++) {
            const slot = ARMOR_SLOTS[index];
            if (remainingArmor[slot].some((piece) => piece.item.set?.id === requirement.setId)) {
                possible += 1;
            }
        }

        return possible >= requirement.requiredPieces;
    });
}

function createSuffixMaxPotential(armor: PreparedArmorBySlot) {
    const suffix: StatTuple[] = Array.from({ length: ARMOR_SLOTS.length + 1 }, () => zeroTuple());

    for (let index = ARMOR_SLOTS.length - 1; index >= 0; index--) {
        const slot = ARMOR_SLOTS[index];
        suffix[index] = addTuples(suffix[index + 1], maxSlotPotential(armor[slot]));
    }

    return suffix;
}

function maxSlotPotential(items: PreparedArmorItem[]) {
    const maxStats = zeroTuple();

    for (const item of items) {
        maxStats[0] = Math.max(maxStats[0], item.max[0]);
        maxStats[1] = Math.max(maxStats[1], item.max[1]);
        maxStats[2] = Math.max(maxStats[2], item.max[2]);
        maxStats[3] = Math.max(maxStats[3], item.max[3]);
        maxStats[4] = Math.max(maxStats[4], item.max[4]);
        maxStats[5] = Math.max(maxStats[5], item.max[5]);
    }

    return maxStats;
}

function itemMaximumStats(item: ArmorItem, tuningMode: TuningMode, dumpStat: ArmorStat | undefined) {
    const cache = getItemCache(itemMaximumStatsCache, item);
    const key = tuningCacheKey(tuningMode, dumpStat);
    const cached = cache.get(key);

    if (cached) {
        return cached;
    }

    const stats = emptyStats();

    for (const stat of ARMOR_STATS) {
        stats[stat] =
            item.baseStats[stat] +
            maxAdjustmentValue(item.statModOptions, stat) +
            (tuningMode === 'off' ? 0 : maxAdjustmentValue(tuningOptionsForMode(item, tuningMode, dumpStat), stat));
    }

    cache.set(key, stats);
    return stats;
}

function maxAdjustmentValue(options: StatAdjustment[], stat: keyof StatVector) {
    return options.reduce((max, option) => Math.max(max, option.deltas[stat] ?? 0), 0);
}

function addTuples(left: StatTuple, right: StatTuple): StatTuple {
    return [left[0] + right[0], left[1] + right[1], left[2] + right[2], left[3] + right[3], left[4] + right[4], left[5] + right[5]];
}

function itemOutcomeTuples(item: ArmorItem, tuningMode: TuningMode, dumpStat: ArmorStat | undefined) {
    const cache = getItemCache(itemOutcomeCache, item);
    const key = tuningCacheKey(tuningMode, dumpStat);
    const cached = cache.get(key);

    if (cached) {
        return cached;
    }

    const outcomes = new Map<string, StatTuple>();
    const tuningOptions = tuningMode === 'off' ? [undefined] : tuningOptionsForMode(item, tuningMode, dumpStat);

    for (const statMod of item.statModOptions) {
        for (const tuning of tuningOptions) {
            const outcome = toStatTuple(addStats(addStats(item.baseStats, statMod.deltas), tuning?.deltas ?? {}));
            outcomes.set(tupleKey(outcome), outcome);
        }
    }

    const values = [...outcomes.values()];
    cache.set(key, values);
    return values;
}

function capTupleToTargets(tuple: StatTuple, targets: StatTuple, targetIndexes: number[]): StatTuple {
    const capped = [...tuple] as StatTuple;

    for (const index of targetIndexes) {
        capped[index] = Math.min(capped[index], targets[index]);
    }

    return capped;
}

function capTupleForCapSearch(tuple: StatTuple, targets: StatTuple, targetIndexes: number[], statIndex: number): StatTuple {
    const capped = capTupleToTargets(tuple, targets, targetIndexes);
    capped[statIndex] = Math.min(capped[statIndex], MAX_DISPLAY_STAT);
    return capped;
}

function tupleMeetsTargetIndexes(tuple: StatTuple, targets: StatTuple, targetIndexes: number[]) {
    return targetIndexes.every((index) => tuple[index] >= targets[index]);
}

function pruneDominatedTargetStates(states: StatTuple[], targetIndexes: number[]) {
    const unique = new Map<string, StatTuple>();

    for (const state of states) {
        unique.set(tupleTargetKey(state, targetIndexes), state);
    }

    const pruned: StatTuple[] = [];
    for (const state of unique.values()) {
        let dominated = false;

        for (let index = pruned.length - 1; index >= 0; index--) {
            const existing = pruned[index];

            if (dominatesTargetState(existing, state, targetIndexes)) {
                dominated = true;
                break;
            }

            if (dominatesTargetState(state, existing, targetIndexes)) {
                pruned.splice(index, 1);
            }
        }

        if (!dominated) {
            pruned.push(state);
        }
    }

    return pruned;
}

function dominatesTargetState(left: StatTuple, right: StatTuple, targetIndexes: number[]) {
    return targetIndexes.every((index) => left[index] >= right[index]);
}

function tupleKey(tuple: StatTuple) {
    return tuple.join(',');
}

function tupleTargetKey(tuple: StatTuple, targetIndexes: number[]) {
    return targetIndexes.map((index) => tuple[index]).join(',');
}

function canStillReachTargets(currentPotential: StatTuple, remainingPotential: StatTuple, targets: StatTuple, dumpStatIndex: number) {
    return (
        (dumpStatIndex === 0 || currentPotential[0] + remainingPotential[0] >= targets[0]) &&
        (dumpStatIndex === 1 || currentPotential[1] + remainingPotential[1] >= targets[1]) &&
        (dumpStatIndex === 2 || currentPotential[2] + remainingPotential[2] >= targets[2]) &&
        (dumpStatIndex === 3 || currentPotential[3] + remainingPotential[3] >= targets[3]) &&
        (dumpStatIndex === 4 || currentPotential[4] + remainingPotential[4] >= targets[4]) &&
        (dumpStatIndex === 5 || currentPotential[5] + remainingPotential[5] >= targets[5])
    );
}

function productRemainingSlots(armor: PreparedArmorBySlot, nextSlotIndex: number) {
    let product = 1;

    for (let index = nextSlotIndex; index < ARMOR_SLOTS.length; index++) {
        product *= armor[ARMOR_SLOTS[index]].length;
    }

    return product;
}

function findBestAddonState(
    pieces: Record<ArmorSlot, ArmorItem>,
    baseStats: StatVector,
    targets: StatVector,
    dumpStat: ArmorStat | undefined,
    tuningMode: TuningMode
) {
    const state: AddonState = {
        stats: baseStats,
        choices: {} as Record<ArmorSlot, AddonChoice>
    };

    for (const slot of ARMOR_SLOTS) {
        const piece = pieces[slot];
        const statMod = chooseBestAdjustment(piece.statModOptions, state.stats, targets, dumpStat, { preferPositiveGain: true });
        const statsAfterMod = addStats(state.stats, statMod?.deltas ?? {});
        const tuning =
            tuningMode === 'off'
                ? undefined
                : chooseBestAdjustment(tuningOptionsForMode(piece, tuningMode, dumpStat), statsAfterMod, targets, dumpStat);
        const deltas = sumStatVectors([statMod?.deltas ?? {}, tuning?.deltas ?? {}]);

        state.stats = addStats(state.stats, deltas);
        state.choices[slot] = {
            statMod,
            tuning,
            deltas
        };
    }

    return meetsSolverTargets(state.stats, targets, dumpStat) ? state : null;
}

function chooseBestAdjustment(
    options: StatAdjustment[],
    stats: StatVector,
    targets: StatVector,
    dumpStat?: ArmorStat,
    preference: AdjustmentPreference = {}
) {
    const noChange = options.find((option) => statTotal(sumStatVectors([option.deltas])) === 0);
    let best = noChange;
    let bestScore = 0;
    let bestDumpRelief = dumpStat && best ? dumpStatRelief(best, dumpStat) : 0;
    let bestOverflow = best ? overflowAmount(addStats(stats, best.deltas)) : 0;
    let bestGain = best ? positiveAdjustmentTotal(best) : 0;

    for (const option of options) {
        const nextStats = addStats(stats, option.deltas);
        const score = totalDeficit(stats, targets, dumpStat) - totalDeficit(nextStats, targets, dumpStat);
        const relief = dumpStat ? dumpStatRelief(option, dumpStat) : 0;
        const overflow = overflowAmount(nextStats);
        const gain = positiveAdjustmentTotal(option);
        const hasUsefulEffect = score > 0 || relief > 0;

        if (
            overflow < bestOverflow ||
            (overflow === bestOverflow && score > bestScore) ||
            (overflow === bestOverflow && score === bestScore && relief > bestDumpRelief) ||
            (preference.preferPositiveGain &&
                overflow === bestOverflow &&
                score === bestScore &&
                relief === bestDumpRelief &&
                gain > bestGain) ||
            (hasUsefulEffect &&
                overflow === bestOverflow &&
                score === bestScore &&
                relief === bestDumpRelief &&
                gain === bestGain &&
                best &&
                option.id.localeCompare(best.id) < 0)
        ) {
            best = option;
            bestScore = score;
            bestDumpRelief = relief;
            bestOverflow = overflow;
            bestGain = gain;
        }
    }

    return best;
}

function overflowAmount(stats: StatVector) {
    return ARMOR_STATS.reduce((total, stat) => total + Math.max(0, stats[stat] - MAX_DISPLAY_STAT), 0);
}

function positiveAdjustmentTotal(adjustment: StatAdjustment) {
    return ARMOR_STATS.reduce((total, stat) => total + Math.max(0, adjustment.deltas[stat] ?? 0), 0);
}

function totalDeficit(stats: StatVector, targets: StatVector, dumpStat?: ArmorStat) {
    return ARMOR_STATS.reduce((total, stat) => {
        if (stat === dumpStat) {
            return total;
        }

        return total + Math.max(0, targets[stat] - stats[stat]);
    }, 0);
}

function dumpStatRelief(adjustment: StatAdjustment, dumpStat: ArmorStat) {
    return Math.max(0, -(adjustment.deltas[dumpStat] ?? 0));
}

function meetsSolverTargets(stats: StatVector, targets: StatVector, dumpStat?: ArmorStat) {
    return ARMOR_STATS.every((stat) => stat === dumpStat || stats[stat] >= targets[stat]);
}

function wastedStatsForSolver(stats: StatVector, targets: StatVector, dumpStat?: ArmorStat) {
    return ARMOR_STATS.reduce((total, stat) => {
        if (stat === dumpStat) {
            return total;
        }

        return total + Math.max(0, stats[stat] - targets[stat]);
    }, 0);
}

function createBuild(pieces: Record<ArmorSlot, ArmorItem>, addonState: AddonState, targets: StatVector, dumpStat?: ArmorStat): ArmorBuild {
    const buildPieces = {} as Record<ArmorSlot, BuildArmorPiece>;
    const finalStats = clampDisplayStats(addonState.stats);

    for (const slot of ARMOR_SLOTS) {
        buildPieces[slot] = {
            item: pieces[slot],
            statMod: addonState.choices[slot]?.statMod,
            tuning: addonState.choices[slot]?.tuning
        };
    }

    return {
        pieces: buildPieces,
        stats: finalStats,
        activeSetBonuses: getActiveSetBonuses(ARMOR_SLOTS.map((slot) => pieces[slot])),
        score: {
            wastedStats: wastedStatsForSolver(finalStats, targets, dumpStat),
            totalStats: statTotal(finalStats)
        }
    };
}

function clampDisplayStats(stats: StatVector) {
    const clamped = emptyStats();

    for (const stat of ARMOR_STATS) {
        clamped[stat] = Math.max(0, Math.min(MAX_DISPLAY_STAT, stats[stat]));
    }

    return clamped;
}

function getActiveSetBonuses(pieces: ArmorItem[]): ActiveArmorSetBonus[] {
    const bySet = new Map<string, { name: string; pieces: number }>();

    for (const piece of pieces) {
        if (!piece.set) {
            continue;
        }

        const current = bySet.get(piece.set.id);
        bySet.set(piece.set.id, {
            name: piece.set.name,
            pieces: (current?.pieces ?? 0) + 1
        });
    }

    return [...bySet.entries()]
        .filter(([, set]) => set.pieces >= 2)
        .map(([setId, set]) => ({
            setId,
            name: set.name,
            pieces: set.pieces,
            activeBonuses: set.pieces >= 4 ? [2, 4] : [2]
        }));
}

function retainBuild(context: SearchContext, build: ArmorBuild) {
    if (context.maxResults <= 0) {
        return;
    }

    if (context.builds.length < context.maxResults) {
        context.builds.push(build);
        return;
    }

    if (!context.resultSort) {
        return;
    }

    const worstIndex = findWorstRetainedBuildIndex(context.builds, context.resultSort);

    if (compareBuilds(build, context.builds[worstIndex], context.resultSort) < 0) {
        context.builds[worstIndex] = build;
    }
}

function findWorstRetainedBuildIndex(builds: ArmorBuild[], sort: ArmorBuildSort) {
    let worstIndex = 0;

    for (let index = 1; index < builds.length; index++) {
        if (compareBuilds(builds[index], builds[worstIndex], sort) > 0) {
            worstIndex = index;
        }
    }

    return worstIndex;
}

function compareBuilds(left: ArmorBuild, right: ArmorBuild, sort: ArmorBuildSort) {
    const direction = sort.direction === 'asc' ? 1 : -1;
    const primary = (buildSortValue(left, sort) - buildSortValue(right, sort)) * direction;

    return (
        primary ||
        left.score.wastedStats - right.score.wastedStats ||
        right.score.totalStats - left.score.totalStats ||
        compareBuildIds(left, right)
    );
}

function buildSortValue(build: ArmorBuild, sort: ArmorBuildSort) {
    if (sort.key === 'wastedStats') {
        return build.score.wastedStats;
    }

    if (sort.key === 'totalStats') {
        return build.score.totalStats;
    }

    return build.stats[sort.key];
}

function compareBuildIds(left: ArmorBuild, right: ArmorBuild) {
    return ARMOR_SLOTS.map((slot) => left.pieces[slot].item.itemInstanceId)
        .join('|')
        .localeCompare(ARMOR_SLOTS.map((slot) => right.pieces[slot].item.itemInstanceId).join('|'));
}
