import {
    ARMOR_SLOTS,
    type ArmorBuild,
    type ArmorBuildSort,
    type ArmorSetRequirement,
    type ArmorSlot,
    type DestinyClass,
    type SolveArmorResult
} from '@armor-calc';

import { limitSetSelections, type SetSelectionValue } from '@/features/armor/calculator-preferences';
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

export type AvailableArmorSet = {
    id: string;
    name: string;
    count: number;
    slotCounts: Record<ArmorSlot, number>;
    bonuses: ArmorSetBonusInfo[];
    opBonuses: OpArmorSetBonus[];
};

export const CHARACTER_BUTTON_CLASSES: CharacterButtonClass[] = ['hunter', 'warlock', 'titan'];
const ARMOR_SLOT_SORT_ORDER = new Map<ArmorSlot, number>(ARMOR_SLOTS.map((slot, index) => [slot, index]));

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
            bonuses,
            opBonuses: getOpArmorSetBonuses({ name: catalogSet.name, bonuses })
        });
    }

    for (const owned of ownedSets.values()) {
        if (!sets.has(owned.id)) {
            sets.set(owned.id, {
                ...owned,
                bonuses: [],
                opBonuses: getOpArmorSetBonuses({ name: owned.name, bonuses: [] })
            });
        }
    }

    return [...sets.values()].sort((left, right) => compareArmorSetsForDisplay(left, right));
}

export function getSelectedSetRequirements(
    selectableSets: AvailableArmorSet[],
    setSelections: Record<string, SetSelectionValue>
): ArmorSetRequirement[] {
    const limitedSelections = limitSetSelections(setSelections);

    return selectableSets
        .map((set) => ({
            setId: set.id,
            requiredPieces: Number(limitedSelections[set.id] ?? '0') as 0 | 2 | 4,
            ownedPieces: set.count
        }))
        .filter(
            (set): set is ArmorSetRequirement & { ownedPieces: number } =>
                (set.requiredPieces === 2 || set.requiredPieces === 4) && set.ownedPieces >= set.requiredPieces
        )
        .map(({ setId, requiredPieces }) => ({ setId, requiredPieces }));
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

export function reconcileSetSelections(
    profile: NormalizedArmorProfile,
    classType: DestinyClass,
    selections: Record<string, SetSelectionValue>
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

    return limitSetSelections(nextSelections);
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
