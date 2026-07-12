import {
    type ActiveArmorSetBonus,
    ARMOR_SLOTS,
    ARMOR_STATS,
    type ArmorBuild,
    type ArmorBuildSort,
    type ArmorInventoryBySlot,
    type ArmorItem,
    type ArmorSetRequirement,
    type ArmorStat,
    type DestinyClass,
    type SolveArmorInput,
    type SolveArmorResult,
    type StatAdjustment,
    type StatVector
} from '@armor-domain';

import type {
    EngineAdjustmentInput,
    EngineBuildOutput,
    EngineCapOutput,
    EngineCapRequest,
    EngineProfileInput,
    EngineRequest,
    EngineSolveOutput,
    EngineSolveRequest,
    EngineStats,
    MaterializedCaps
} from './types';

const CLASS_INDEX: Record<DestinyClass, number> = {
    titan: 0,
    hunter: 1,
    warlock: 2,
    any: 3
};
const SORT_INDEX: Record<ArmorBuildSort['key'], number> = {
    health: 0,
    melee: 1,
    grenade: 2,
    super: 3,
    class: 4,
    weapons: 5,
    wastedStats: 6,
    totalStats: 7
};

export class ArmorEngineAdapter {
    readonly profile: EngineProfileInput;
    readonly armor: ArmorInventoryBySlot;
    private readonly sourceItems: ArmorItem[];
    private readonly setIndexes = new Map<string, number>();

    constructor(armor: ArmorInventoryBySlot) {
        this.armor = armor;
        this.sourceItems = ARMOR_SLOTS.flatMap((slot) =>
            [...armor[slot]].sort((left, right) => left.itemInstanceId.localeCompare(right.itemInstanceId))
        );
        for (const item of this.sourceItems) {
            if (item.set && !this.setIndexes.has(item.set.id)) {
                this.setIndexes.set(item.set.id, this.setIndexes.size + 1);
            }
        }
        this.profile = {
            items: this.sourceItems.map((item, sourceIndex) => this.compactItem(item, sourceIndex))
        };
    }

    createCapRequest(input: SolveArmorInput, requestedStats: readonly ArmorStat[]): EngineCapRequest {
        return {
            ...this.createRequest(input),
            requestedStats: requestedStats.map((stat) => ARMOR_STATS.indexOf(stat))
        };
    }

    createSolveRequest(input: SolveArmorInput): EngineSolveRequest {
        return {
            ...this.createRequest(input),
            maxResults: input.maxResults ?? 50,
            resultSort: input.resultSort
                ? {
                      key: SORT_INDEX[input.resultSort.key],
                      descending: input.resultSort.direction === 'desc'
                  }
                : null,
            stopWhenResultLimitReached: input.stopWhenResultLimitReached === true
        };
    }

    materializeCaps(output: EngineCapOutput): MaterializedCaps {
        return {
            caps: tupleToStats(output.caps),
            searchedCombinations: Number(output.searchedCombinations),
            rejectedCombinations: Number(output.rejectedCombinations)
        };
    }

    materializeSolve(output: EngineSolveOutput): SolveArmorResult {
        const common = {
            validBuildCount: Number(output.validBuildCount),
            returnedBuildCount: Number(output.returnedBuildCount),
            resultLimitReached: output.resultLimitReached,
            searchedCombinations: Number(output.searchedCombinations),
            rejectedCombinations: Number(output.rejectedCombinations),
            warnings: []
        };
        if (!output.ok) {
            return {
                ok: false,
                reason: output.reason ?? 'No build matched the selected targets and constraints.',
                ...common
            };
        }

        return {
            ok: true,
            builds: output.builds.map((build) => this.materializeBuild(build)),
            ...common
        };
    }

    private createRequest(input: SolveArmorInput): EngineRequest {
        return {
            classType: CLASS_INDEX[input.classType],
            selectedExoticItemHash: input.selectedExoticItemHash ?? null,
            dumpStat: input.dumpStat ? ARMOR_STATS.indexOf(input.dumpStat) : null,
            allowBalancedTuning: input.allowBalancedTuning === true,
            targets: statsToTuple(input.statTargets),
            statBonuses: statsToTuple(input.statBonuses),
            setRequirements: input.setRequirements.map((requirement) => this.compactSetRequirement(requirement))
        };
    }

    private compactItem(item: ArmorItem, sourceIndex: number) {
        return {
            sourceIndex,
            stableId: item.itemInstanceId,
            itemHash: item.itemHash,
            slot: ARMOR_SLOTS.indexOf(item.slot),
            classType: CLASS_INDEX[item.classType],
            isExotic: item.isExotic,
            setId: item.set ? (this.setIndexes.get(item.set.id) ?? null) : null,
            baseStats: statsToTuple(item.baseStats),
            statMods: compactAdjustments(item.statModOptions),
            tunings: compactAdjustments(item.tuningOptions)
        };
    }

    private compactSetRequirement(requirement: ArmorSetRequirement) {
        const setId = this.setIndexes.get(requirement.setId) ?? this.setIndexes.size + 1;
        this.setIndexes.set(requirement.setId, setId);
        return {
            setId,
            requiredPieces: requirement.requiredPieces
        };
    }

    private materializeBuild(output: EngineBuildOutput): ArmorBuild {
        const selectedItems = output.itemIndices.map((sourceIndex) => {
            const item = this.sourceItems[sourceIndex];
            if (!item) {
                throw new Error(`Rust armor engine returned unknown source item ${sourceIndex}.`);
            }
            return item;
        });
        const pieces = Object.fromEntries(
            ARMOR_SLOTS.map((slot, slotIndex) => {
                const item = selectedItems[slotIndex];
                if (!item) {
                    throw new Error(`Rust armor engine omitted ${slot}.`);
                }
                return [
                    slot,
                    {
                        item,
                        statMod: adjustmentAt(item.statModOptions, output.statModIndices[slotIndex]),
                        tuning: adjustmentAt(item.tuningOptions, output.tuningIndices[slotIndex])
                    }
                ];
            })
        ) as ArmorBuild['pieces'];

        return {
            pieces,
            stats: tupleToStats(output.stats),
            activeSetBonuses: activeSetBonuses(selectedItems),
            score: {
                wastedStats: output.wastedStats,
                totalStats: output.totalStats
            }
        };
    }
}

const compactAdjustments = (adjustments: StatAdjustment[]): EngineAdjustmentInput[] =>
    adjustments.map((adjustment, sourceIndex) => ({
        sourceIndex,
        deltas: statsToTuple(adjustment.deltas)
    }));

const adjustmentAt = (adjustments: StatAdjustment[], sourceIndex: number): StatAdjustment | undefined =>
    sourceIndex < 0 ? undefined : adjustments[sourceIndex];

const statsToTuple = (stats: Partial<StatVector> | undefined): EngineStats =>
    ARMOR_STATS.map((stat) => Math.trunc(stats?.[stat] ?? 0)) as EngineStats;

const tupleToStats = (stats: EngineStats): StatVector =>
    Object.fromEntries(ARMOR_STATS.map((stat, index) => [stat, stats[index]])) as StatVector;

const activeSetBonuses = (items: ArmorItem[]): ActiveArmorSetBonus[] => {
    const counts = new Map<string, { name: string; pieces: number }>();
    for (const item of items) {
        if (!item.set) {
            continue;
        }
        const current = counts.get(item.set.id);
        counts.set(item.set.id, {
            name: item.set.name,
            pieces: (current?.pieces ?? 0) + 1
        });
    }
    return [...counts.entries()]
        .filter(([, set]) => set.pieces >= 2)
        .map(([setId, set]) => ({
            setId,
            name: set.name,
            pieces: set.pieces,
            activeBonuses: set.pieces >= 4 ? [2, 4] : [2]
        }));
};
