import {
    ARMOR_SLOTS,
    type ArmorBuild,
    type ArmorBuildSort,
    type ArmorPerkInfo,
    type ArmorSetRequirement,
    type ArmorSlot,
    type DestinyClass,
    type SolveArmorResult
} from '@rose/armor-domain';

import { applySetSelectionLimit, limitSetSelections, type SetSelectionValue } from '@/features/armor/calculator-preferences';
import { getArmorForClass, getAvailableArmorSets } from '@/features/armor/normalize';
import { getOpArmorSetBonuses, type OpArmorSetBonus, opArmorSetSortRank } from '@/features/armor/op-set-bonuses';
import type { ArmorSetBonusInfo, NormalizedArmorProfile, NormalizedCharacter } from '@/features/armor/types';

export type ResultSortKey = ArmorBuildSort['key'];
export type CharacterButtonClass = Extract<DestinyClass, 'hunter' | 'warlock' | 'titan'>;

export type CharacterButtonOption = {
    classType: CharacterButtonClass;
    character: NormalizedCharacter | null;
};

export type AvailableExotic = {
    itemHash: number;
    name: string;
    iconUrl?: string | undefined;
    slot: ArmorSlot;
    count: number;
};

export type AvailableExoticClassItemRoll = {
    key: string;
    label: string;
    perks: ArmorPerkInfo[];
    count: number;
};

export type AvailableArmorSet = {
    id: string;
    name: string;
    count: number;
    slotCounts: Record<ArmorSlot, number>;
    catalogSlots: ArmorSlot[];
    bonuses: ArmorSetBonusInfo[];
    opBonuses: OpArmorSetBonus[];
};

export type ArmorSetAvailabilitySource = 'catalog' | 'owned';

export const CHARACTER_BUTTON_CLASSES: CharacterButtonClass[] = ['hunter', 'warlock', 'titan'];
const ARMOR_SLOT_SORT_ORDER = new Map<ArmorSlot, number>(ARMOR_SLOTS.map((slot, index) => [slot, index]));
const ARMOR_SLOT_BITS = new Map<ArmorSlot, number>(ARMOR_SLOTS.map((slot, index) => [slot, 1 << index]));

export type ArmorSetRequirementAvailability = {
    canSelect: boolean;
    usableSlotCount: number;
};

export function getSelectedCharacter(profile: NormalizedArmorProfile | null, selectedCharacterId: string) {
    return profile?.characters.find((character) => character.characterId === selectedCharacterId) ?? profile?.characters[0] ?? null;
}

export function getCharacterButtonOptions(profile: NormalizedArmorProfile | null): CharacterButtonOption[] {
    const characters = profile?.characters ?? [];
    return CHARACTER_BUTTON_CLASSES.map((classType) => ({
        classType,
        character: characters.find((character) => character.classType === classType) ?? null
    }));
}

export function getAvailableExoticOptions(
    profile: NormalizedArmorProfile | null,
    character: NormalizedCharacter | null
): AvailableExotic[] {
    if (!profile || !character) {
        return [];
    }

    const exoticsByHash = new Map<number, AvailableExotic>();

    for (const item of getArmorForClass(profile.armor, character.classType).filter((armorItem) => armorItem.isExotic)) {
        const current = exoticsByHash.get(item.itemHash);
        exoticsByHash.set(item.itemHash, {
            itemHash: item.itemHash,
            name: item.name,
            iconUrl: current?.iconUrl ?? item.iconUrl,
            slot: item.slot,
            count: (current?.count ?? 0) + 1
        });
    }

    return [...exoticsByHash.values()].sort(
        (left, right) =>
            (ARMOR_SLOT_SORT_ORDER.get(left.slot) ?? 0) - (ARMOR_SLOT_SORT_ORDER.get(right.slot) ?? 0) ||
            left.name.localeCompare(right.name)
    );
}

export function getAvailablePlanningExoticOptions(
    profile: NormalizedArmorProfile | null,
    character: NormalizedCharacter | null
): AvailableExotic[] {
    return getAvailableExoticOptions(profile, character).filter((exotic) => exotic.slot !== 'classItem');
}

export function getAvailableExoticClassItemRolls(
    profile: NormalizedArmorProfile | null,
    character: NormalizedCharacter | null,
    selectedItemHash: string
): AvailableExoticClassItemRoll[] {
    if (!profile || !character || !selectedItemHash) {
        return [];
    }

    const itemHash = Number(selectedItemHash);
    const rolls = new Map<string, AvailableExoticClassItemRoll>();

    for (const item of getArmorForClass(profile.armor, character.classType)) {
        if (
            !item.isExotic ||
            item.slot !== 'classItem' ||
            item.itemHash !== itemHash ||
            !item.exoticClassItemPerkKey ||
            !item.exoticClassItemPerks?.length
        ) {
            continue;
        }

        const current = rolls.get(item.exoticClassItemPerkKey);
        rolls.set(item.exoticClassItemPerkKey, {
            key: item.exoticClassItemPerkKey,
            label: item.exoticClassItemPerks.map((perk) => perk.name).join(' + '),
            perks: item.exoticClassItemPerks,
            count: (current?.count ?? 0) + (item.equivalentItemInstanceIds?.length ?? 1)
        });
    }

    return [...rolls.values()].sort((left, right) => left.label.localeCompare(right.label));
}

export function getSelectableArmorSets(profile: NormalizedArmorProfile | null, character: NormalizedCharacter | null): AvailableArmorSet[] {
    if (!profile || !character) {
        return [];
    }

    const ownedSets = new Map(getAvailableArmorSets(profile.armor, character.classType).map((set) => [set.id, set]));
    const sets = new Map<string, AvailableArmorSet>();

    for (const catalogSet of profile.armorSetCatalog.filter((set) =>
        isCatalogSetCompatibleWithClass(set.classTypes, character.classType)
    )) {
        const owned = ownedSets.get(catalogSet.id);
        const bonuses = catalogSet.bonuses;
        sets.set(catalogSet.id, {
            id: catalogSet.id,
            name: catalogSet.name,
            count: owned?.count ?? 0,
            slotCounts: owned?.slotCounts ?? emptySlotCounts(),
            catalogSlots: catalogSet.slots,
            bonuses,
            opBonuses: getOpArmorSetBonuses({ name: catalogSet.name, bonuses })
        });
    }

    for (const owned of ownedSets.values()) {
        if (!sets.has(owned.id)) {
            sets.set(owned.id, {
                ...owned,
                catalogSlots: ARMOR_SLOTS.filter((slot) => owned.slotCounts[slot] > 0),
                bonuses: [],
                opBonuses: getOpArmorSetBonuses({ name: owned.name, bonuses: [] })
            });
        }
    }

    return [...sets.values()].sort((left, right) => compareArmorSetsForDisplay(left, right));
}

export function getSelectedSetRequirements(
    selectableSets: AvailableArmorSet[],
    setSelections: Record<string, SetSelectionValue>,
    blockedSlots: readonly ArmorSlot[] = [],
    availabilitySource: ArmorSetAvailabilitySource = 'owned'
): ArmorSetRequirement[] {
    const limitedSelections = limitSetSelections(setSelections);
    const requirements = setRequirementsFromSelections(selectableSets, limitedSelections, availabilitySource);

    return areArmorSetRequirementsSlotCompatible(selectableSets, requirements, blockedSlots, availabilitySource) ? requirements : [];
}

export function getArmorSetRequirementAvailability(
    selectableSets: AvailableArmorSet[],
    setSelections: Record<string, SetSelectionValue>,
    setId: string,
    requiredPieces: 2 | 4,
    blockedSlots: readonly ArmorSlot[] = [],
    availabilitySource: ArmorSetAvailabilitySource = 'owned'
): ArmorSetRequirementAvailability {
    const set = selectableSets.find((candidate) => candidate.id === setId);
    const usableSlotCount = set ? countUsableArmorSetSlots(set, blockedSlots, availabilitySource) : 0;
    const selectedValue = setSelections[setId] ?? '0';

    if (!set) {
        return { canSelect: false, usableSlotCount };
    }

    if (selectedValue === String(requiredPieces)) {
        return { canSelect: true, usableSlotCount };
    }

    if (usableSlotCount < requiredPieces) {
        return { canSelect: false, usableSlotCount };
    }

    const previewSelections = applySetSelectionLimit(setSelections, setId, String(requiredPieces) as SetSelectionValue);
    if (previewSelections[setId] !== String(requiredPieces)) {
        return { canSelect: false, usableSlotCount };
    }

    return {
        canSelect: areArmorSetRequirementsSlotCompatible(
            selectableSets,
            setRequirementsFromSelections(selectableSets, previewSelections, availabilitySource),
            blockedSlots,
            availabilitySource
        ),
        usableSlotCount
    };
}

export function sortArmorBuildsForDisplay(builds: ArmorBuild[], sort: ArmorBuildSort) {
    return [...builds].sort((left, right) => compareArmorBuildsForDisplay(left, right, sort));
}

export function compareArmorBuildsForDisplay(left: ArmorBuild, right: ArmorBuild, sort: ArmorBuildSort) {
    const direction = sort.direction === 'asc' ? 1 : -1;
    const primary = armorBuildSortValue(left, sort.key) - armorBuildSortValue(right, sort.key);

    return primary * direction || left.score.wastedStats - right.score.wastedStats || right.score.totalStats - left.score.totalStats;
}

export function toggleArmorBuildSort(current: ArmorBuildSort, key: ResultSortKey): ArmorBuildSort {
    return {
        key,
        direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    };
}

export function getResultFailure(result: SolveArmorResult | null) {
    return result && !result.ok ? result.reason : null;
}

export function reconcileSelectedExotic(profile: NormalizedArmorProfile, classType: DestinyClass, selectedItemHash: string) {
    if (!selectedItemHash) {
        return '';
    }

    const selectedHash = Number(selectedItemHash);
    const hasCompatibleExotic = getArmorForClass(profile.armor, classType).some((item) => item.isExotic && item.itemHash === selectedHash);

    return hasCompatibleExotic ? selectedItemHash : '';
}

export function reconcileSelectedExoticClassItemRoll(rolls: readonly AvailableExoticClassItemRoll[], selectedPerkKey: string): string {
    return selectedPerkKey && rolls.some((roll) => roll.key === selectedPerkKey) ? selectedPerkKey : '';
}

export function reconcileSetSelections(
    profile: NormalizedArmorProfile,
    classType: DestinyClass,
    selections: Record<string, SetSelectionValue>,
    blockedSlots: readonly ArmorSlot[] = []
) {
    const availableById = new Map(getAvailableArmorSets(profile.armor, classType).map((set) => [set.id, set]));
    const nextSelections: Record<string, SetSelectionValue> = {};

    for (const [setId, selection] of Object.entries(selections)) {
        const set = availableById.get(setId);
        if (!set || set.count < 2) {
            continue;
        }

        nextSelections[setId] = selection === '4' && set.count < 4 ? '2' : selection;
    }

    const limitedSelections = limitSetSelections(nextSelections);
    const selectableSets = getSelectableArmorSets(profile, { characterId: '', classType, label: '' });

    return areArmorSetRequirementsSlotCompatible(
        selectableSets,
        setRequirementsFromSelections(selectableSets, limitedSelections),
        blockedSlots
    )
        ? limitedSelections
        : {};
}

function armorBuildSortValue(build: ArmorBuild, key: ResultSortKey) {
    if (key === 'wastedStats') {
        return build.score.wastedStats;
    }

    if (key === 'totalStats') {
        return build.score.totalStats;
    }

    return build.stats[key];
}

function compareArmorSetsForDisplay(left: AvailableArmorSet, right: AvailableArmorSet) {
    const leftOpRank = opArmorSetSortRank(left);
    const rightOpRank = opArmorSetSortRank(right);
    const opRankCompare = Number.isFinite(leftOpRank) || Number.isFinite(rightOpRank) ? leftOpRank - rightOpRank : 0;

    return (
        opRankCompare ||
        Number(right.opBonuses.length > 0) - Number(left.opBonuses.length > 0) ||
        right.count - left.count ||
        left.name.localeCompare(right.name)
    );
}

function emptySlotCounts(): Record<ArmorSlot, number> {
    return {
        helmet: 0,
        arms: 0,
        chest: 0,
        legs: 0,
        classItem: 0
    };
}

function isCatalogSetCompatibleWithClass(classTypes: DestinyClass[], classType: DestinyClass) {
    return classTypes.length === 0 || classTypes.includes('any') || classTypes.includes(classType);
}

function setRequirementsFromSelections(
    selectableSets: AvailableArmorSet[],
    selections: Record<string, SetSelectionValue>,
    availabilitySource: ArmorSetAvailabilitySource = 'owned'
): ArmorSetRequirement[] {
    const setsById = new Map(selectableSets.map((set) => [set.id, set]));

    return Object.entries(limitSetSelections(selections)).flatMap(([setId, value]) => {
        const requiredPieces = Number(value) as 0 | 2 | 4;
        const set = setsById.get(setId);

        if (
            !set ||
            (requiredPieces !== 2 && requiredPieces !== 4) ||
            (availabilitySource === 'owned' && set.count < requiredPieces) ||
            countUsableArmorSetSlots(set, [], availabilitySource) < requiredPieces
        ) {
            return [];
        }

        return [{ setId, requiredPieces }];
    });
}

function areArmorSetRequirementsSlotCompatible(
    selectableSets: AvailableArmorSet[],
    requirements: readonly ArmorSetRequirement[],
    blockedSlots: readonly ArmorSlot[] = [],
    availabilitySource: ArmorSetAvailabilitySource = 'owned'
) {
    return findArmorSetSlotAllocation(selectableSets, requirements, blockedSlots, availabilitySource) !== null;
}

export function getPlanningSetSlotAssignments(
    selectableSets: AvailableArmorSet[],
    requirements: readonly ArmorSetRequirement[],
    blockedSlots: readonly ArmorSlot[] = []
): Partial<Record<ArmorSlot, string>> | null {
    return findArmorSetSlotAllocation(selectableSets, requirements, blockedSlots, 'catalog');
}

function findArmorSetSlotAllocation(
    selectableSets: AvailableArmorSet[],
    requirements: readonly ArmorSetRequirement[],
    blockedSlots: readonly ArmorSlot[],
    availabilitySource: ArmorSetAvailabilitySource
): Partial<Record<ArmorSlot, string>> | null {
    const setsById = new Map(selectableSets.map((set) => [set.id, set]));
    const blockedMask = slotsToMask(blockedSlots);
    const sortedRequirements = [...requirements].sort((left, right) => right.requiredPieces - left.requiredPieces);

    const allocate = (requirementIndex: number, usedMask: number): Partial<Record<ArmorSlot, string>> | null => {
        const requirement = sortedRequirements[requirementIndex];
        if (!requirement) {
            return {};
        }

        const set = setsById.get(requirement.setId);
        if (!set) {
            return null;
        }

        const availableSlots = ARMOR_SLOTS.filter((slot) => {
            const bit = ARMOR_SLOT_BITS.get(slot) ?? 0;
            return armorSetHasSlot(set, slot, availabilitySource) && (usedMask & bit) === 0;
        });

        if (availableSlots.length < requirement.requiredPieces) {
            return null;
        }

        let allocation: Partial<Record<ArmorSlot, string>> | null = null;
        chooseRequiredSlots(availableSlots, requirement.requiredPieces, 0, 0, (choiceMask) => {
            const remaining = allocate(requirementIndex + 1, usedMask | choiceMask);
            if (!remaining) {
                return false;
            }

            allocation = { ...remaining };
            for (const slot of availableSlots) {
                const bit = ARMOR_SLOT_BITS.get(slot) ?? 0;
                if ((choiceMask & bit) !== 0) {
                    allocation[slot] = requirement.setId;
                }
            }

            return true;
        });

        return allocation;
    };

    return allocate(0, blockedMask);
}

function chooseRequiredSlots(
    slots: readonly ArmorSlot[],
    requiredPieces: 2 | 4,
    startIndex: number,
    selectedMask: number,
    predicate: (selectedMask: number) => boolean
): boolean {
    const selectedCount = countBits(selectedMask);
    if (selectedCount === requiredPieces) {
        return predicate(selectedMask);
    }

    const remainingNeeded = requiredPieces - selectedCount;
    for (let index = startIndex; index <= slots.length - remainingNeeded; index += 1) {
        const bit = ARMOR_SLOT_BITS.get(slots[index] as ArmorSlot) ?? 0;
        if (chooseRequiredSlots(slots, requiredPieces, index + 1, selectedMask | bit, predicate)) {
            return true;
        }
    }

    return false;
}

function countUsableArmorSetSlots(
    set: AvailableArmorSet,
    blockedSlots: readonly ArmorSlot[] = [],
    availabilitySource: ArmorSetAvailabilitySource = 'owned'
) {
    const blocked = new Set(blockedSlots);
    return ARMOR_SLOTS.filter((slot) => armorSetHasSlot(set, slot, availabilitySource) && !blocked.has(slot)).length;
}

function armorSetHasSlot(set: AvailableArmorSet, slot: ArmorSlot, availabilitySource: ArmorSetAvailabilitySource) {
    return availabilitySource === 'catalog' ? set.catalogSlots.includes(slot) : set.slotCounts[slot] > 0;
}

function slotsToMask(slots: readonly ArmorSlot[]) {
    return slots.reduce((mask, slot) => mask | (ARMOR_SLOT_BITS.get(slot) ?? 0), 0);
}

function countBits(value: number) {
    let count = 0;
    let remaining = value;

    while (remaining > 0) {
        count += remaining & 1;
        remaining >>= 1;
    }

    return count;
}
