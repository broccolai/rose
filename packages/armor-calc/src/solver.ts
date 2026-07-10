import {
    type AddonChoice,
    type AddonPlanResult,
    type AddonState,
    type CompiledAddonProfile,
    type CompiledAddonWorkspace,
    createCompiledAddonProfile,
    createCompiledAddonWorkspace,
    solveCompiledAddons,
    updateCompiledAddonCaps,
    updateStandardModCaps
} from './compiled-addons';
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
const FRONTIER_CHUNK_SIZE = 524_288;
const MAX_DISPLAY_STAT = 200;
const TUNING_MODES = ['off', 'pair', 'all'] as const;
const itemMaximumStatsCache = new WeakMap<ArmorItem, Map<string, StatVector>>();
const simpleAddonCapabilityCache = new WeakMap<ArmorItem, Map<string, boolean>>();
const preparedArmorItemCache = new WeakMap<ArmorItem, Map<string, PreparedArmorItem>>();
const itemOutcomeCache = new WeakMap<ArmorItem, Map<string, StatTuple[]>>();
const itemAddonChoiceOutcomeCache = new WeakMap<ArmorItem, Map<string, AddonChoiceOutcome[]>>();

type StatTuple = [number, number, number, number, number, number];
type TuningMode = (typeof TUNING_MODES)[number];

type PreparedArmorItem = {
    item: ArmorItem;
    base: StatTuple;
    max: StatTuple;
    simpleAddons: boolean;
    compiledAddonProfile: CompiledAddonProfile | null;
};

type PreparedArmorBySlot = Record<ArmorSlot, PreparedArmorItem[]>;

type AddonChoiceOutcome = {
    statMod?: StatAdjustment | undefined;
    tuning?: StatAdjustment | undefined;
    deltas: StatVector;
    tuple: StatTuple;
};

type ExactAddonSearchState = {
    capped: StatTuple;
    stats: StatTuple;
    choices?: Partial<Record<ArmorSlot, AddonChoice>> | undefined;
};

type FrontierState = {
    stats: StatTuple;
    setCounts: number[];
};

type FrontierSearch = {
    targetValues: StatTuple;
    trackedCaps: StatTuple;
    trackedIndexes: number[];
    targetIndexes: number[];
    scoreIndex: number;
    setRequirements: ArmorSetRequirement[];
    tuningMode: TuningMode;
    dumpStat?: ArmorStat | undefined;
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
    compiledAddonProfiles: Array<CompiledAddonProfile | null>;
    compiledAddonWorkspace: CompiledAddonWorkspace;
};

export function solveArmor(input: SolveArmorInput): SolveArmorResult {
    const warnings: string[] = [];
    const targets = normalizeTargets(input.statTargets);
    const statBonuses = normalizeStatBonuses(input.statBonuses);
    const dumpStatIndex = input.dumpStat ? ARMOR_STATS.indexOf(input.dumpStat) : -1;
    const tuningMode = tuningModeForInput(input.dumpStat, input.allowBalancedTuning);
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
        foundValid: false,
        compiledAddonProfiles: Array.from({ length: ARMOR_SLOTS.length }, () => null),
        compiledAddonWorkspace: createCompiledAddonWorkspace()
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

export function calculateArmorStatTargetCaps(
    input: ArmorStatTargetCapsInput,
    requestedStats: readonly ArmorStat[] = ARMOR_STATS
): StatVector {
    const caps = emptyStats();
    const baseTargets = normalizeTargets(input.statTargets);
    const statBonuses = normalizeStatBonuses(input.statBonuses);
    const dumpStatIndex = input.dumpStat ? ARMOR_STATS.indexOf(input.dumpStat) : -1;
    const tuningMode = tuningModeForInput(input.dumpStat, input.allowBalancedTuning);
    const plans = createCandidatePlans(input.armor, input.classType, input.selectedExoticItemHash, tuningMode, input.dumpStat);

    if (plans.every((plan) => ARMOR_SLOTS.some((slot) => plan.armor[slot].length === 0))) {
        return caps;
    }

    if (input.dumpStat) {
        baseTargets[input.dumpStat] = 0;
    }

    const compiledCaps = calculatePreparedCompiledStatTargetCaps(
        plans,
        baseTargets,
        statBonuses,
        input.dumpStat,
        tuningMode,
        input.setRequirements,
        requestedStats
    );
    if (compiledCaps) {
        return compiledCaps;
    }

    for (const stat of requestedStats) {
        caps[stat] =
            stat === input.dumpStat
                ? 0
                : calculatePreparedArmorStatTargetCapByFrontier(
                      plans,
                      baseTargets,
                      statBonuses,
                      ARMOR_STATS.indexOf(stat),
                      dumpStatIndex,
                      tuningMode,
                      input.dumpStat,
                      input.setRequirements
                  );
    }

    return caps;
}

function calculatePreparedCompiledStatTargetCaps(
    plans: CandidatePlan[],
    targets: StatVector,
    statBonuses: StatVector,
    dumpStat: ArmorStat | undefined,
    tuningMode: TuningMode,
    setRequirements: ArmorSetRequirement[],
    requestedStats: readonly ArmorStat[]
): StatVector | null {
    const supportsCompiledAddons = plans.every((plan) =>
        ARMOR_SLOTS.every((slot) =>
            plan.armor[slot].every((item) => (tuningMode === 'off' ? item.simpleAddons : item.compiledAddonProfile !== null))
        )
    );
    if (!supportsCompiledAddons) {
        return null;
    }

    const requestedIndexes = [...new Set(requestedStats.map((stat) => ARMOR_STATS.indexOf(stat)))].filter(
        (index) => !dumpStat || index !== ARMOR_STATS.indexOf(dumpStat)
    );
    const caps = emptyStats();
    if (requestedIndexes.length === 0) {
        return caps;
    }

    const context: CompiledCapSearchContext = {
        targetValues: toStatTuple(targets),
        dumpStatIndex: dumpStat ? ARMOR_STATS.indexOf(dumpStat) : -1,
        tuningMode,
        allowBalancedTuning: tuningMode === 'all',
        requestedIndexes,
        setRequirements,
        caps,
        compiledAddonProfiles: Array.from({ length: ARMOR_SLOTS.length }, () => null),
        compiledAddonWorkspace: createCompiledAddonWorkspace()
    };

    for (const plan of plans) {
        if (ARMOR_SLOTS.some((slot) => plan.armor[slot].length === 0)) {
            continue;
        }

        searchCompiledCaps(plan, context, [], 0, toStatTuple(statBonuses), toStatTuple(statBonuses));
    }

    return caps;
}

interface CompiledCapSearchContext {
    targetValues: StatTuple;
    dumpStatIndex: number;
    tuningMode: TuningMode;
    allowBalancedTuning: boolean;
    requestedIndexes: number[];
    setRequirements: ArmorSetRequirement[];
    caps: StatVector;
    compiledAddonProfiles: Array<CompiledAddonProfile | null>;
    compiledAddonWorkspace: CompiledAddonWorkspace;
}

function searchCompiledCaps(
    plan: CandidatePlan,
    context: CompiledCapSearchContext,
    selectedList: PreparedArmorItem[],
    slotIndex: number,
    baseStats: StatTuple,
    potentialStats: StatTuple
) {
    if (requestedCapsComplete(context.caps, context.requestedIndexes)) {
        return;
    }

    if (
        !canStillReachAnyCapScenario(
            potentialStats,
            plan.suffixMaxPotential[slotIndex],
            context.targetValues,
            context.dumpStatIndex,
            context.requestedIndexes
        ) ||
        (context.setRequirements.length > 0 && !canStillMeetSetRequirements(selectedList, plan.armor, slotIndex, context.setRequirements))
    ) {
        return;
    }

    if (slotIndex >= ARMOR_SLOTS.length) {
        if (context.setRequirements.length > 0 && !satisfiesSetRequirements(selectedList, context.setRequirements)) {
            return;
        }

        if (context.tuningMode === 'off') {
            updateStandardModCaps(context.caps, baseStats, context.targetValues, context.requestedIndexes, context.compiledAddonWorkspace);
        } else {
            updateCompiledAddonCaps(
                context.caps,
                context.compiledAddonProfiles as CompiledAddonProfile[],
                baseStats,
                context.targetValues,
                context.dumpStatIndex,
                context.allowBalancedTuning,
                context.requestedIndexes,
                context.compiledAddonWorkspace
            );
        }
        return;
    }

    const slot = ARMOR_SLOTS[slotIndex];
    for (const item of plan.armor[slot]) {
        context.compiledAddonProfiles[slotIndex] = item.compiledAddonProfile;
        selectedList.push(item);
        addTupleInPlace(baseStats, item.base, 1);
        addTupleInPlace(potentialStats, item.max, 1);

        searchCompiledCaps(plan, context, selectedList, slotIndex + 1, baseStats, potentialStats);

        addTupleInPlace(baseStats, item.base, -1);
        addTupleInPlace(potentialStats, item.max, -1);
        selectedList.pop();
    }
}

function canStillReachAnyCapScenario(
    currentPotential: StatTuple,
    remainingPotential: StatTuple,
    targets: StatTuple,
    dumpStatIndex: number,
    requestedIndexes: number[]
) {
    for (const scoreIndex of requestedIndexes) {
        let reachable = true;
        for (let index = 0; index < ARMOR_STATS.length; index++) {
            if (index !== dumpStatIndex && index !== scoreIndex && currentPotential[index] + remainingPotential[index] < targets[index]) {
                reachable = false;
                break;
            }
        }

        if (reachable) {
            return true;
        }
    }

    return false;
}

function requestedCapsComplete(caps: StatVector, requestedIndexes: number[]) {
    for (const index of requestedIndexes) {
        if (caps[ARMOR_STATS[index]] < MAX_DISPLAY_STAT) {
            return false;
        }
    }

    return true;
}

export function calculateArmorStatTargetCap(input: ArmorStatTargetCapsInput, stat: ArmorStat): number {
    return calculateArmorStatTargetCaps(input, [stat])[stat];
}

export function canReachArmorStatTargets(input: ArmorStatTargetCapsInput) {
    const targets = normalizeTargets(input.statTargets);
    const statBonuses = normalizeStatBonuses(input.statBonuses);
    const dumpStatIndex = input.dumpStat ? ARMOR_STATS.indexOf(input.dumpStat) : -1;
    const tuningMode = tuningModeForInput(input.dumpStat, input.allowBalancedTuning);
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
    return canReachPreparedArmorStatTargetsByFrontier(plans, targets, statBonuses, dumpStatIndex, tuningMode, dumpStat, setRequirements);
}

function canReachPreparedArmorStatTargetsByFrontier(
    plans: CandidatePlan[],
    targets: StatVector,
    statBonuses: StatVector,
    dumpStatIndex: number,
    tuningMode: TuningMode,
    dumpStat: ArmorStat | undefined,
    setRequirements: ArmorSetRequirement[]
) {
    const search = createFrontierSearch(toStatTuple(targets), dumpStatIndex, -1, setRequirements, tuningMode, dumpStat);

    for (const plan of plans) {
        if (ARMOR_SLOTS.some((slot) => plan.armor[slot].length === 0)) {
            continue;
        }

        const initialState = createInitialFrontierState(toStatTuple(statBonuses), search);
        if (frontierStateMeetsTargets(initialState, search)) {
            return true;
        }

        const result = buildFrontierStates(plan, search, initialState, true);
        if (result.foundTarget) {
            return true;
        }
    }

    return false;
}

function calculatePreparedArmorStatTargetCapByFrontier(
    plans: CandidatePlan[],
    targets: StatVector,
    statBonuses: StatVector,
    statIndex: number,
    dumpStatIndex: number,
    tuningMode: TuningMode,
    dumpStat: ArmorStat | undefined,
    setRequirements: ArmorSetRequirement[]
) {
    if (statIndex === dumpStatIndex) {
        return 0;
    }

    const targetValues = toStatTuple(targets);
    const search = createFrontierSearch(targetValues, dumpStatIndex, statIndex, setRequirements, tuningMode, dumpStat);
    let best = 0;

    for (const plan of plans) {
        if (ARMOR_SLOTS.some((slot) => plan.armor[slot].length === 0)) {
            continue;
        }

        const initialState = createInitialFrontierState(toStatTuple(statBonuses), search);
        const result = buildFrontierStates(plan, search, initialState, false);

        for (const state of result.states) {
            if (frontierStateMeetsTargets(state, search)) {
                best = Math.max(best, state.stats[statIndex]);
                if (best >= MAX_DISPLAY_STAT) {
                    return MAX_DISPLAY_STAT;
                }
            }
        }
    }

    return best;
}

function createFrontierSearch(
    targetValues: StatTuple,
    dumpStatIndex: number,
    scoreIndex: number,
    setRequirements: ArmorSetRequirement[],
    tuningMode: TuningMode,
    dumpStat: ArmorStat | undefined
): FrontierSearch {
    const targetIndexes = targetIndexesForTargets(targetValues, dumpStatIndex, scoreIndex);
    const trackedIndexes = scoreIndex >= 0 ? [...targetIndexes, scoreIndex] : targetIndexes;
    const trackedCaps = zeroTuple();

    for (const index of trackedIndexes) {
        trackedCaps[index] = index === scoreIndex ? MAX_DISPLAY_STAT : targetValues[index];
    }

    return {
        targetValues,
        trackedCaps,
        trackedIndexes,
        targetIndexes,
        scoreIndex,
        setRequirements,
        tuningMode,
        dumpStat
    };
}

function createInitialFrontierState(stats: StatTuple, search: FrontierSearch): FrontierState {
    return {
        stats: capTupleForFrontier(stats, search),
        setCounts: search.setRequirements.map(() => 0)
    };
}

function buildFrontierStates(plan: CandidatePlan, search: FrontierSearch, initialState: FrontierState, stopAfterFirstTarget: boolean) {
    let states = [initialState];

    for (const slot of ARMOR_SLOTS) {
        let nextStates: FrontierState[] = [];
        let retainedStates: FrontierState[] = [];

        for (const state of states) {
            for (const item of plan.armor[slot]) {
                for (const outcome of itemOutcomeTuples(item.item, search.tuningMode, search.dumpStat)) {
                    const nextState = addFrontierOutcome(state, item, outcome, search);
                    if (stopAfterFirstTarget && frontierStateMeetsTargets(nextState, search)) {
                        return {
                            foundTarget: true,
                            states: [nextState]
                        };
                    }

                    nextStates.push(nextState);
                    if (nextStates.length >= FRONTIER_CHUNK_SIZE) {
                        retainedStates = pruneDominatedFrontierStates([...retainedStates, ...nextStates], search);
                        nextStates = [];
                    }
                }
            }
        }

        states = pruneDominatedFrontierStates([...retainedStates, ...nextStates], search);
        if (states.length === 0) {
            break;
        }
    }

    return {
        foundTarget: states.some((state) => frontierStateMeetsTargets(state, search)),
        states
    };
}

function addFrontierOutcome(state: FrontierState, item: PreparedArmorItem, outcome: StatTuple, search: FrontierSearch): FrontierState {
    return {
        stats: capTupleForFrontier(addTuples(state.stats, outcome), search),
        setCounts: addFrontierSetCounts(state.setCounts, item, search.setRequirements)
    };
}

function addFrontierSetCounts(counts: number[], item: PreparedArmorItem, requirements: ArmorSetRequirement[]) {
    if (requirements.length === 0 || !item.item.set) {
        return counts;
    }

    const nextCounts = [...counts];
    for (const [index, requirement] of requirements.entries()) {
        if (item.item.set.id === requirement.setId) {
            nextCounts[index] = Math.min(requirement.requiredPieces, nextCounts[index] + 1);
        }
    }

    return nextCounts;
}

function capTupleForFrontier(tuple: StatTuple, search: FrontierSearch): StatTuple {
    const capped = zeroTuple();

    for (const index of search.trackedIndexes) {
        capped[index] = Math.min(tuple[index], search.trackedCaps[index]);
    }

    return capped;
}

function frontierStateMeetsTargets(state: FrontierState, search: FrontierSearch) {
    return (
        tupleMeetsTargetIndexes(state.stats, search.targetValues, search.targetIndexes) && frontierStateMeetsSetRequirements(state, search)
    );
}

function frontierStateMeetsSetRequirements(state: FrontierState, search: FrontierSearch) {
    return search.setRequirements.every((requirement, index) => state.setCounts[index] >= requirement.requiredPieces);
}

function pruneDominatedFrontierStates(states: FrontierState[], search: FrontierSearch) {
    const unique = new Map<number | string, FrontierState>();

    for (const state of states) {
        const key = frontierStateKey(state, search.trackedIndexes);
        const current = unique.get(key);
        if (!current || tupleTotal(state.stats) > tupleTotal(current.stats)) {
            unique.set(key, state);
        }
    }

    const pruned: FrontierState[] = [];
    for (const state of unique.values()) {
        let dominated = false;

        for (let index = pruned.length - 1; index >= 0; index -= 1) {
            const existing = pruned[index];
            if (!existing) {
                continue;
            }

            if (dominatesFrontierState(existing, state, search.trackedIndexes)) {
                dominated = true;
                break;
            }

            if (dominatesFrontierState(state, existing, search.trackedIndexes)) {
                pruned.splice(index, 1);
            }
        }

        if (!dominated) {
            pruned.push(state);
        }
    }

    return pruned;
}

function dominatesFrontierState(left: FrontierState, right: FrontierState, trackedIndexes: number[]) {
    return dominatesTargetState(left.stats, right.stats, trackedIndexes) && dominatesSetCounts(left.setCounts, right.setCounts);
}

function dominatesSetCounts(left: number[], right: number[]) {
    return left.every((count, index) => count >= right[index]);
}

function frontierStateKey(state: FrontierState, trackedIndexes: number[]): number | string {
    let key = 0;

    for (const index of trackedIndexes) {
        const value = state.stats[index];
        if (!Number.isInteger(value) || value < 0 || value > MAX_DISPLAY_STAT) {
            return `${tupleTargetKey(state.stats, trackedIndexes)}|${state.setCounts.join(',')}`;
        }
        key = key * (MAX_DISPLAY_STAT + 1) + value;
    }

    for (const count of state.setCounts) {
        key = key * 5 + count;
        if (!Number.isSafeInteger(key)) {
            return `${tupleTargetKey(state.stats, trackedIndexes)}|${state.setCounts.join(',')}`;
        }
    }

    return key;
}

function targetIndexesForTargets(targetValues: StatTuple, dumpStatIndex: number, excludedIndex = -1) {
    return targetValues
        .map((target, index) => ({ index, target }))
        .filter(({ index, target }) => index !== dumpStatIndex && index !== excludedIndex && target > 0)
        .map(({ index }) => index);
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
        suffixMaxPotential: createSuffixMaxPotential(armor)
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
        simpleAddons: hasSimpleStatModsAndNoTuning(item, tuningMode, dumpStat),
        compiledAddonProfile: tuningMode !== 'off' ? createCompiledAddonProfile(item, dumpStat) : null
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
        const bestAddonState = evaluateAddonState(pieces, baseStats, context, shouldRetainBuild);

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
        context.compiledAddonProfiles[slotIndex] = item.compiledAddonProfile;
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
    context: SearchContext,
    retainState: boolean
): AddonPlanResult {
    let allSimpleAddons = true;
    let allCompiledAddons = context.tuningMode !== 'off';
    for (let slotIndex = 0; slotIndex < ARMOR_SLOTS.length; slotIndex++) {
        const piece = pieces[ARMOR_SLOTS[slotIndex]];
        allSimpleAddons = allSimpleAddons && piece.simpleAddons;
        allCompiledAddons = allCompiledAddons && context.compiledAddonProfiles[slotIndex] !== null;
    }

    if (allSimpleAddons) {
        return evaluateSimpleStatMods(pieces, baseStats, context.targetValues, context.dumpStatIndex, retainState);
    }

    if (allCompiledAddons) {
        return solveCompiledAddons(
            context.compiledAddonProfiles as CompiledAddonProfile[],
            baseStats,
            context.targetValues,
            context.dumpStatIndex,
            context.tuningMode === 'all',
            retainState,
            context.compiledAddonWorkspace
        );
    }

    if (tupleMeetsTargets(baseStats, context.targetValues, context.dumpStatIndex)) {
        return {
            valid: true,
            state: retainState ? createEmptyAddonState(tupleToStats(baseStats)) : null
        };
    }

    const unpreparedPieces = unpreparePieces(pieces);
    const greedyState = findGreedyAddonState(
        unpreparedPieces,
        tupleToStats(baseStats),
        context.targets,
        context.dumpStat,
        context.tuningMode
    );

    if (meetsSolverTargets(greedyState.stats, context.targets, context.dumpStat)) {
        return {
            valid: true,
            state: retainState ? greedyState : null
        };
    }

    const exactState = findExactAddonState(
        unpreparedPieces,
        tupleToStats(baseStats),
        context.targets,
        context.dumpStat,
        context.tuningMode,
        retainState
    );

    if (!exactState) {
        return {
            valid: false,
            state: null
        };
    }

    return {
        valid: true,
        state: retainState ? exactState : null
    };
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

function findExactAddonState(
    pieces: Record<ArmorSlot, ArmorItem>,
    baseStats: StatVector,
    targets: StatVector,
    dumpStat: ArmorStat | undefined,
    tuningMode: TuningMode,
    retainChoices: boolean
) {
    const targetValues = toStatTuple(targets);
    const dumpStatIndex = dumpStat ? ARMOR_STATS.indexOf(dumpStat) : -1;
    const targetIndexes = targetIndexesForTargets(targetValues, dumpStatIndex);
    let states: ExactAddonSearchState[] = [
        {
            capped: capTupleToTargets(toStatTuple(baseStats), targetValues, targetIndexes),
            stats: toStatTuple(baseStats),
            choices: retainChoices ? {} : undefined
        }
    ];

    for (const slot of ARMOR_SLOTS) {
        const nextStates: ExactAddonSearchState[] = [];

        for (const state of states) {
            for (const outcome of itemAddonChoiceOutcomes(pieces[slot], tuningMode, dumpStat)) {
                const stats = addTuples(state.stats, outcome.tuple);
                const capped = capTupleToTargets(stats, targetValues, targetIndexes);
                nextStates.push({
                    capped,
                    stats,
                    choices: retainChoices
                        ? {
                              ...state.choices,
                              [slot]: {
                                  statMod: outcome.statMod,
                                  tuning: outcome.tuning,
                                  deltas: outcome.deltas
                              }
                          }
                        : undefined
                });
            }
        }

        states = pruneDominatedExactAddonStates(nextStates, targetIndexes);
        if (states.length === 0) {
            return null;
        }
    }

    const validStates = states.filter((state) => tupleMeetsTargetIndexes(state.capped, targetValues, targetIndexes));
    const bestState = validStates.sort(
        (left, right) => exactAddonStateScore(right, targetValues, dumpStatIndex) - exactAddonStateScore(left, targetValues, dumpStatIndex)
    )[0];

    if (!bestState) {
        return null;
    }

    return {
        stats: tupleToStats(bestState.stats),
        choices: Object.fromEntries(
            ARMOR_SLOTS.map((slot) => [
                slot,
                bestState.choices?.[slot] ?? {
                    deltas: emptyStats()
                }
            ])
        ) as Record<ArmorSlot, AddonChoice>
    };
}

function itemAddonChoiceOutcomes(item: ArmorItem, tuningMode: TuningMode, dumpStat: ArmorStat | undefined) {
    const cache = getItemCache(itemAddonChoiceOutcomeCache, item);
    const key = tuningCacheKey(tuningMode, dumpStat);
    const cached = cache.get(key);

    if (cached) {
        return cached;
    }

    const outcomes = new Map<string, AddonChoiceOutcome>();
    const tuningOptions = tuningMode === 'off' ? [undefined] : tuningOptionsForMode(item, tuningMode, dumpStat);

    for (const statMod of item.statModOptions) {
        for (const tuning of tuningOptions) {
            const deltas = sumStatVectors([statMod.deltas, tuning?.deltas ?? {}]);
            const tuple = toStatTuple(deltas);
            outcomes.set(tupleKey(tuple), {
                statMod,
                tuning,
                deltas,
                tuple
            });
        }
    }

    const values = [...outcomes.values()];
    cache.set(key, values);
    return values;
}

function pruneDominatedExactAddonStates(states: ExactAddonSearchState[], targetIndexes: number[]) {
    const unique = new Map<string, ExactAddonSearchState>();

    for (const state of states) {
        const key = tupleTargetKey(state.capped, targetIndexes);
        const current = unique.get(key);
        if (!current || tupleTotal(state.stats) > tupleTotal(current.stats)) {
            unique.set(key, state);
        }
    }

    const pruned: ExactAddonSearchState[] = [];
    for (const state of unique.values()) {
        let dominated = false;

        for (let index = pruned.length - 1; index >= 0; index -= 1) {
            const existing = pruned[index];
            if (!existing) {
                continue;
            }

            if (dominatesTargetState(existing.capped, state.capped, targetIndexes)) {
                dominated = true;
                break;
            }

            if (dominatesTargetState(state.capped, existing.capped, targetIndexes)) {
                pruned.splice(index, 1);
            }
        }

        if (!dominated) {
            pruned.push(state);
        }
    }

    return pruned;
}

function exactAddonStateScore(state: ExactAddonSearchState, targets: StatTuple, dumpStatIndex: number) {
    return -tupleWaste(state.stats, targets, dumpStatIndex) * 1_000 + tupleTotal(state.stats);
}

function tupleWaste(stats: StatTuple, targets: StatTuple, dumpStatIndex: number) {
    return (
        (dumpStatIndex === 0 ? 0 : Math.max(0, stats[0] - targets[0])) +
        (dumpStatIndex === 1 ? 0 : Math.max(0, stats[1] - targets[1])) +
        (dumpStatIndex === 2 ? 0 : Math.max(0, stats[2] - targets[2])) +
        (dumpStatIndex === 3 ? 0 : Math.max(0, stats[3] - targets[3])) +
        (dumpStatIndex === 4 ? 0 : Math.max(0, stats[4] - targets[4])) +
        (dumpStatIndex === 5 ? 0 : Math.max(0, stats[5] - targets[5]))
    );
}

function tupleTotal(stats: StatTuple) {
    return stats[0] + stats[1] + stats[2] + stats[3] + stats[4] + stats[5];
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

function tuningModeForInput(dumpStat: ArmorStat | undefined, allowBalancedTuning: boolean | undefined): TuningMode {
    if (!dumpStat) {
        return allowBalancedTuning ? 'all' : 'pair';
    }

    return allowBalancedTuning ? 'all' : 'pair';
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

function tupleMeetsTargetIndexes(tuple: StatTuple, targets: StatTuple, targetIndexes: number[]) {
    return targetIndexes.every((index) => tuple[index] >= targets[index]);
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

function findGreedyAddonState(
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

    return state;
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
