import { ARMOR_SLOTS, type ArmorPlan, type ArmorSlot } from '@armor-domain';

import { type AvailableArmorSet, type AvailableExotic, getPlanningSetSlotAssignments } from '@/features/armor/calculator-view-model';

export interface PlanningSlotRequirement {
    slot: ArmorSlot;
    kind: 'any' | 'exotic' | 'set';
    label: string;
    setId?: string | undefined;
}

interface PlanningSlotRequirementInput {
    armorSets: AvailableArmorSet[];
    setRequirements: Array<{ setId: string; requiredPieces: 2 | 4 }>;
    selectedExotic?: AvailableExotic | undefined;
}

export const createPlanningSlotRequirements = (input: PlanningSlotRequirementInput): Record<ArmorSlot, PlanningSlotRequirement> | null => {
    const blockedSlots = input.selectedExotic ? [input.selectedExotic.slot] : [];
    const setAssignments = getPlanningSetSlotAssignments(input.armorSets, input.setRequirements, blockedSlots);
    if (!setAssignments) {
        return null;
    }

    const setsById = new Map(input.armorSets.map((set) => [set.id, set]));

    return Object.fromEntries(
        ARMOR_SLOTS.map((slot) => {
            if (input.selectedExotic?.slot === slot) {
                return [
                    slot,
                    {
                        slot,
                        kind: 'exotic',
                        label: input.selectedExotic.name
                    }
                ];
            }

            const setId = setAssignments[slot];
            const set = setId ? setsById.get(setId) : undefined;
            if (set) {
                return [
                    slot,
                    {
                        slot,
                        kind: 'set',
                        label: set.name,
                        setId
                    }
                ];
            }

            return [
                slot,
                {
                    slot,
                    kind: 'any',
                    label: 'Any Tier 5 armor'
                }
            ];
        })
    ) as Record<ArmorSlot, PlanningSlotRequirement>;
};

export const armorPlanExpansionKey = (plan: ArmorPlan): string =>
    ARMOR_SLOTS.map((slot) => {
        const piece = plan.pieces[slot];
        return [piece.roll.id, piece.statMod?.id ?? 'none', piece.tuning?.id ?? 'none'].join(':');
    }).join('|');
