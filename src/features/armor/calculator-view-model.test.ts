import { describe, expect, test } from 'bun:test';

import { ARMOR_SLOTS, type ArmorBuild, type ArmorItem, type ArmorStat, type StatVector } from '@armor-domain';

import {
    getArmorSetRequirementAvailability,
    getAvailableExoticOptions,
    getAvailablePlanningExoticOptions,
    getCharacterButtonOptions,
    getPlanningSetSlotAssignments,
    getSelectableArmorSets,
    getSelectedCharacter,
    getSelectedSetRequirements,
    reconcileSelectedExotic,
    reconcileSetSelections,
    sortArmorBuildsForDisplay,
    toggleArmorBuildSort
} from '@/features/armor/calculator-view-model';
import type { NormalizedArmorProfile } from '@/features/armor/types';

describe('calculator view model', () => {
    test('selects the requested character or falls back to the first profile character', () => {
        const profile = profileWithArmor([]);

        expect(getSelectedCharacter(profile, 'hunter')?.classType).toBe('hunter');
        expect(getSelectedCharacter(profile, 'missing')?.classType).toBe('warlock');
        expect(getSelectedCharacter(null, 'hunter')).toBeNull();
    });

    test('builds fixed class button options in hunter warlock titan order', () => {
        const profile = profileWithArmor([]);

        expect(getCharacterButtonOptions(profile).map((option) => [option.classType, option.character?.characterId ?? null])).toEqual([
            ['hunter', 'hunter'],
            ['warlock', 'warlock'],
            ['titan', null]
        ]);
    });

    test('dedupes compatible exotic rolls by item hash', () => {
        const profile = profileWithArmor([
            armor({ itemInstanceId: 'warlock-exotic-a', itemHash: 10, name: 'Transversive Steps', classType: 'warlock', isExotic: true }),
            armor({ itemInstanceId: 'warlock-exotic-b', itemHash: 10, name: 'Transversive Steps', classType: 'warlock', isExotic: true }),
            armor({ itemInstanceId: 'hunter-exotic', itemHash: 20, name: 'Stompees', classType: 'hunter', isExotic: true })
        ]);

        expect(getAvailableExoticOptions(profile, profile.characters[0])).toEqual([
            {
                itemHash: 10,
                name: 'Transversive Steps',
                slot: 'helmet',
                count: 2
            }
        ]);
    });

    test('sorts exotic choices by armor slot before name', () => {
        const profile = profileWithArmor([
            armor({ itemInstanceId: 'legs', itemHash: 40, name: 'Transversive Steps', slot: 'legs', isExotic: true }),
            armor({ itemInstanceId: 'helmet-b', itemHash: 20, name: 'Verity Brow', slot: 'helmet', isExotic: true }),
            armor({ itemInstanceId: 'chest', itemHash: 30, name: 'Mantle', slot: 'chest', isExotic: true }),
            armor({ itemInstanceId: 'helmet-a', itemHash: 10, name: 'Crown', slot: 'helmet', isExotic: true }),
            armor({ itemInstanceId: 'arms', itemHash: 50, name: 'Sunbracers', slot: 'arms', isExotic: true })
        ]);

        expect(getAvailableExoticOptions(profile, profile.characters[0]).map((exotic) => `${exotic.slot}:${exotic.name}`)).toEqual([
            'helmet:Crown',
            'helmet:Verity Brow',
            'arms:Sunbracers',
            'chest:Mantle',
            'legs:Transversive Steps'
        ]);
    });

    test('excludes fixed-roll exotic class items from future-roll planning', () => {
        const profile = profileWithArmor([
            armor({ itemInstanceId: 'helmet', itemHash: 10, name: "Nezarec's Sin", slot: 'helmet', isExotic: true }),
            armor({ itemInstanceId: 'class-item', itemHash: 20, name: 'Solipsism', slot: 'classItem', isExotic: true })
        ]);

        expect(getAvailableExoticOptions(profile, profile.characters[0]).map((exotic) => exotic.name)).toEqual([
            "Nezarec's Sin",
            'Solipsism'
        ]);
        expect(getAvailablePlanningExoticOptions(profile, profile.characters[0]).map((exotic) => exotic.name)).toEqual(["Nezarec's Sin"]);
    });

    test('shows catalog armor sets with owned counts and converts possible choices to requirements', () => {
        const profile = profileWithArmor([
            armor({ itemInstanceId: 'set-a-1', setId: 'set:a' }),
            armor({ itemInstanceId: 'set-a-2', setId: 'set:a', slot: 'arms' }),
            armor({ itemInstanceId: 'set-b-1', setId: 'set:b' })
        ]);
        profile.armorSetCatalog = [
            {
                id: 'set:c',
                name: 'Catalog Set',
                equipableItemSetHash: 30,
                itemHashes: [],
                classTypes: ['warlock'],
                slots: ['helmet'],
                bonuses: [{ requiredPieces: 2, name: 'Catalog 2pc' }]
            }
        ];
        const sets = getSelectableArmorSets(profile, profile.characters[0]);

        expect(sets).toEqual([
            {
                id: 'set:a',
                name: 'set:a',
                count: 2,
                slotCounts: { helmet: 1, arms: 1, chest: 0, legs: 0, classItem: 0 },
                catalogSlots: ['helmet', 'arms'],
                bonuses: [],
                opBonuses: []
            },
            {
                id: 'set:b',
                name: 'set:b',
                count: 1,
                slotCounts: { helmet: 1, arms: 0, chest: 0, legs: 0, classItem: 0 },
                catalogSlots: ['helmet'],
                bonuses: [],
                opBonuses: []
            },
            {
                id: 'set:c',
                name: 'Catalog Set',
                count: 0,
                slotCounts: { helmet: 0, arms: 0, chest: 0, legs: 0, classItem: 0 },
                catalogSlots: ['helmet'],
                bonuses: [{ requiredPieces: 2, name: 'Catalog 2pc' }],
                opBonuses: []
            }
        ]);
        expect(getSelectedSetRequirements(sets, { 'set:a': '2' })).toEqual([{ setId: 'set:a', requiredPieces: 2 }]);
        expect(getSelectedSetRequirements(sets, { 'set:b': '2', 'set:c': '2' })).toEqual([]);
        expect(getSelectedSetRequirements(sets, { 'set:a': '0' })).toEqual([]);
        expect(getSelectedSetRequirements(sets, { 'set:a': '2', 'set:c': '4' })).toEqual([]);
    });

    test('plans unowned catalog sets across disjoint slots around an exotic', () => {
        const profile = profileWithArmor([]);
        profile.armorSetCatalog = [
            {
                id: 'set:a',
                name: 'First Set',
                equipableItemSetHash: 10,
                itemHashes: [],
                classTypes: ['warlock'],
                slots: ['helmet', 'arms', 'chest'],
                bonuses: [{ requiredPieces: 2, name: 'First Bonus' }]
            },
            {
                id: 'set:b',
                name: 'Second Set',
                equipableItemSetHash: 20,
                itemHashes: [],
                classTypes: ['warlock'],
                slots: ['chest', 'legs', 'classItem'],
                bonuses: [{ requiredPieces: 2, name: 'Second Bonus' }]
            }
        ];
        const sets = getSelectableArmorSets(profile, profile.characters[0]);
        const requirements = getSelectedSetRequirements(sets, { 'set:a': '2', 'set:b': '2' }, ['helmet'], 'catalog');

        expect(requirements).toEqual([
            { setId: 'set:a', requiredPieces: 2 },
            { setId: 'set:b', requiredPieces: 2 }
        ]);
        expect(getPlanningSetSlotAssignments(sets, requirements, ['helmet'])).toEqual({
            arms: 'set:a',
            chest: 'set:a',
            legs: 'set:b',
            classItem: 'set:b'
        });
    });

    test('checks armor set choices against usable slots instead of raw owned count', () => {
        const profile = profileWithArmor([
            armor({ itemInstanceId: 'a-legs-1', setId: 'set:a', slot: 'legs' }),
            armor({ itemInstanceId: 'a-legs-2', setId: 'set:a', slot: 'legs' }),
            armor({ itemInstanceId: 'a-chest-1', setId: 'set:a', slot: 'chest' }),
            armor({ itemInstanceId: 'a-chest-2', setId: 'set:a', slot: 'chest' })
        ]);
        const sets = getSelectableArmorSets(profile, profile.characters[0]);

        expect(getArmorSetRequirementAvailability(sets, {}, 'set:a', 2)).toEqual({
            canSelect: true,
            usableSlotCount: 2
        });
        expect(getArmorSetRequirementAvailability(sets, {}, 'set:a', 4)).toEqual({
            canSelect: false,
            usableSlotCount: 2
        });
        expect(getSelectedSetRequirements(sets, { 'set:a': '4' })).toEqual([]);
    });

    test('disables second 2pc set when selected sets cannot occupy disjoint slots', () => {
        const profile = profileWithArmor([
            armor({ itemInstanceId: 'a-legs', setId: 'set:a', slot: 'legs' }),
            armor({ itemInstanceId: 'a-chest', setId: 'set:a', slot: 'chest' }),
            armor({ itemInstanceId: 'b-legs', setId: 'set:b', slot: 'legs' }),
            armor({ itemInstanceId: 'b-chest', setId: 'set:b', slot: 'chest' }),
            armor({ itemInstanceId: 'c-helmet', setId: 'set:c', slot: 'helmet' }),
            armor({ itemInstanceId: 'c-arms', setId: 'set:c', slot: 'arms' })
        ]);
        const sets = getSelectableArmorSets(profile, profile.characters[0]);

        expect(getArmorSetRequirementAvailability(sets, { 'set:a': '2' }, 'set:b', 2).canSelect).toBe(false);
        expect(getArmorSetRequirementAvailability(sets, { 'set:a': '2' }, 'set:c', 2).canSelect).toBe(true);
        expect(getSelectedSetRequirements(sets, { 'set:a': '2', 'set:b': '2' })).toEqual([]);
        expect(getSelectedSetRequirements(sets, { 'set:a': '2', 'set:c': '2' })).toEqual([
            { setId: 'set:a', requiredPieces: 2 },
            { setId: 'set:c', requiredPieces: 2 }
        ]);
    });

    test('selected exotic slot blocks armor set requirements that need that slot', () => {
        const profile = profileWithArmor([
            armor({ itemInstanceId: 'a-helmet', setId: 'set:a', slot: 'helmet' }),
            armor({ itemInstanceId: 'a-arms', setId: 'set:a', slot: 'arms' }),
            armor({ itemInstanceId: 'a-chest', setId: 'set:a', slot: 'chest' }),
            armor({ itemInstanceId: 'a-legs', setId: 'set:a', slot: 'legs' })
        ]);
        const sets = getSelectableArmorSets(profile, profile.characters[0]);

        expect(getArmorSetRequirementAvailability(sets, {}, 'set:a', 4, ['helmet'])).toEqual({
            canSelect: false,
            usableSlotCount: 3
        });
        expect(getSelectedSetRequirements(sets, { 'set:a': '4' }, ['helmet'])).toEqual([]);
    });

    test('pins op armor sets before ordinary sets', () => {
        const profile = profileWithArmor([
            armor({ itemInstanceId: 'ordinary-1', name: 'Ordinary Set', set: { id: 'set:ordinary', name: 'Ordinary Set' } }),
            armor({ itemInstanceId: 'ordinary-2', name: 'Ordinary Set', set: { id: 'set:ordinary', name: 'Ordinary Set' } }),
            armor({ itemInstanceId: 'ordinary-3', name: 'Ordinary Set', set: { id: 'set:ordinary', name: 'Ordinary Set' } }),
            armor({ itemInstanceId: 'spire-1', name: 'TM-Earp Custom Hood', set: { id: 'set:spire', name: 'TM-Earp Custom Hood' } })
        ]);

        const sets = getSelectableArmorSets(profile, profile.characters[0]);

        expect(sets[0]?.name).toBe('TM-Earp Custom Hood');
        expect(sets[0]?.opBonuses.map((bonus) => bonus.id)).toEqual(['spire-4']);
        expect(sets[1]?.name).toBe('Ordinary Set');
    });

    test('reconciles stale exotic and set selections after profile changes', () => {
        const profile = profileWithArmor([
            armor({ itemInstanceId: 'exotic', itemHash: 10, isExotic: true }),
            armor({ itemInstanceId: 'set-a-1', setId: 'set:a' }),
            armor({ itemInstanceId: 'set-a-2', setId: 'set:a' }),
            armor({ itemInstanceId: 'set-b-1', setId: 'set:b' }),
            armor({ itemInstanceId: 'set-b-2', setId: 'set:b' }),
            armor({ itemInstanceId: 'set-b-3', setId: 'set:b' })
        ]);

        expect(reconcileSelectedExotic(profile, 'warlock', '10')).toBe('10');
        expect(reconcileSelectedExotic(profile, 'hunter', '10')).toBe('');
        expect(reconcileSetSelections(profile, 'warlock', { 'set:a': '4', 'set:b': '4', stale: '2' })).toEqual({
            'set:a': '2',
            'set:b': '2'
        });
    });

    test('sorts retained builds and toggles sort direction', () => {
        const builds = [
            build({ weapons: 100, totalStats: 400, wastedStats: 5 }),
            build({ weapons: 200, totalStats: 350, wastedStats: 2 }),
            build({ weapons: 200, totalStats: 500, wastedStats: 10 })
        ];

        expect(
            sortArmorBuildsForDisplay(builds, { key: 'weapons', direction: 'desc' }).map((candidate) => candidate.score.totalStats)
        ).toEqual([350, 500, 400]);
        expect(toggleArmorBuildSort({ key: 'totalStats', direction: 'asc' }, 'totalStats')).toEqual({
            key: 'totalStats',
            direction: 'desc'
        });
    });
});

function profileWithArmor(armorItems: ArmorItem[]): NormalizedArmorProfile {
    return {
        characters: [
            { characterId: 'warlock', classType: 'warlock', label: 'Warlock' },
            { characterId: 'hunter', classType: 'hunter', label: 'Hunter' }
        ],
        armor: armorItems,
        armorBySlot: {
            helmet: [],
            arms: [],
            chest: [],
            legs: [],
            classItem: []
        },
        armorSetCatalog: [],
        warnings: []
    };
}

function armor(options: Partial<ArmorItem> & { itemInstanceId: string; setId?: string }): ArmorItem {
    return {
        itemHash: 1,
        name: options.setId ?? 'Armor',
        slot: 'helmet',
        classType: 'warlock',
        isExotic: false,
        baseStats: zeroStats(),
        statModOptions: [],
        tuningOptions: [],
        ...options,
        set: options.setId ? { id: options.setId, name: options.setId } : options.set
    };
}

function build(options: Partial<Record<ArmorStat, number>> & { wastedStats: number; totalStats: number }): ArmorBuild {
    return {
        pieces: Object.fromEntries(
            ARMOR_SLOTS.map((slot) => [
                slot,
                {
                    item: armor({ itemInstanceId: slot, slot })
                }
            ])
        ) as ArmorBuild['pieces'],
        stats: {
            ...zeroStats(),
            ...options
        },
        activeSetBonuses: [],
        score: {
            wastedStats: options.wastedStats,
            totalStats: options.totalStats
        }
    };
}

function zeroStats(): StatVector {
    return {
        health: 0,
        melee: 0,
        grenade: 0,
        super: 0,
        class: 0,
        weapons: 0
    };
}
