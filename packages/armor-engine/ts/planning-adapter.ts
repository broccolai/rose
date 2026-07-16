import {
    ARMOR_ROLL_PROFILES,
    ARMOR_SLOTS,
    ARMOR_STATS,
    type ArmorPlan,
    type ArmorPlanStatCapsInput,
    type ArmorRollProfile,
    type PlanArmorInput,
    type PlanArmorResult
} from '@rose/armor-domain';

import type {
    EngineBuildOutput,
    EngineCapOutput,
    EngineCapRequest,
    EnginePlanningProfileInput,
    EngineRequest,
    EngineSolveOutput,
    EngineSolveRequest,
    MaterializedCaps
} from './types';
import { adjustmentAt, compactAdjustments, statsToTuple, tupleToStats } from './wire';

const DEFAULT_PLAN_LIMIT = 25;

export class ArmorPlanningAdapter {
    readonly profile: EnginePlanningProfileInput;
    readonly rolls: readonly ArmorRollProfile[];

    constructor(rolls: readonly ArmorRollProfile[] = ARMOR_ROLL_PROFILES) {
        this.rolls = rolls;
        this.profile = {
            rolls: rolls.map((roll, sourceIndex) => ({
                sourceIndex,
                stableId: roll.id,
                baseStats: statsToTuple(roll.baseStats),
                statMods: compactAdjustments(roll.statModOptions),
                tunings: compactAdjustments(roll.tuningOptions)
            }))
        };
    }

    createCapRequest(input: ArmorPlanStatCapsInput, requestedStats: readonly (typeof ARMOR_STATS)[number][]): EngineCapRequest {
        return {
            ...this.createRequest(input),
            requestedStats: requestedStats.map((stat) => ARMOR_STATS.indexOf(stat))
        };
    }

    createSolveRequest(input: PlanArmorInput): EngineSolveRequest {
        return {
            ...this.createRequest(input),
            maxResults: input.maxResults ?? DEFAULT_PLAN_LIMIT,
            resultSort: null,
            stopWhenResultLimitReached: true
        };
    }

    materializeCaps(output: EngineCapOutput): MaterializedCaps {
        return {
            caps: tupleToStats(output.caps),
            searchedCombinations: Number(output.searchedCombinations),
            rejectedCombinations: Number(output.rejectedCombinations)
        };
    }

    materializePlans(output: EngineSolveOutput): PlanArmorResult {
        const common = {
            validPlanCount: Number(output.validBuildCount),
            returnedPlanCount: Number(output.returnedBuildCount),
            resultLimitReached: output.resultLimitReached,
            searchedRollCombinations: Number(output.searchedCombinations),
            rejectedRollCombinations: Number(output.rejectedCombinations)
        };

        if (!output.ok) {
            return {
                ok: false,
                reason: output.reason ?? 'No legal Tier 5 roll plan matched these targets.',
                ...common
            };
        }

        return {
            ok: true,
            plans: output.builds.map((build) => this.materializePlan(build)),
            ...common
        };
    }

    private createRequest(input: ArmorPlanStatCapsInput): EngineRequest {
        return {
            classType: 0,
            selectedExoticItemHash: null,
            selectedExoticVariantId: null,
            dumpStat: input.dumpStat ? ARMOR_STATS.indexOf(input.dumpStat) : null,
            allowBalancedTuning: input.allowBalancedTuning === true,
            targets: statsToTuple(input.statTargets),
            statBonuses: statsToTuple(input.statBonuses),
            setRequirements: []
        };
    }

    private materializePlan(output: EngineBuildOutput): ArmorPlan {
        const pieces = Object.fromEntries(
            ARMOR_SLOTS.map((slot, slotIndex) => {
                const rollIndex = output.itemIndices[slotIndex];
                const roll = this.rolls[rollIndex];
                if (!roll) {
                    throw new Error(`Rust armor planner returned unknown roll profile ${rollIndex}.`);
                }

                return [
                    slot,
                    {
                        roll,
                        statMod: adjustmentAt(roll.statModOptions, output.statModIndices[slotIndex]),
                        tuning: adjustmentAt(roll.tuningOptions, output.tuningIndices[slotIndex])
                    }
                ];
            })
        ) as ArmorPlan['pieces'];

        return {
            pieces,
            stats: tupleToStats(output.stats),
            score: {
                wastedStats: output.wastedStats,
                totalStats: output.totalStats
            }
        };
    }
}
