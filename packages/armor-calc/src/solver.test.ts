import { describe, expect, test } from 'bun:test';

import {
    ARMOR_STATS,
    type ArmorItem,
    type ArmorSlot,
    type ArmorStat,
    calculateArmorStatTargetCap,
    calculateArmorStatTargetCaps,
    createAdjustment,
    createDefaultStatModOptions,
    createTierFiveTuningOptions,
    type StatVector,
    solveArmor,
    statTotal
} from '.';

const slots: ArmorSlot[] = ['helmet', 'arms', 'chest', 'legs', 'classItem'];
const baseStats: StatVector = {
    health: 10,
    melee: 10,
    grenade: 10,
    super: 10,
    class: 10,
    weapons: 10
};

function item(slot: ArmorSlot, overrides: Partial<ArmorItem> = {}): ArmorItem {
    const armor: ArmorItem = {
        itemInstanceId: `${slot}-${overrides.name ?? 'item'}`,
        itemHash: Math.floor(Math.random() * 1_000_000),
        name: `${slot} item`,
        slot,
        classType: 'hunter',
        isExotic: false,
        baseStats,
        statModOptions: [{ id: 'none', name: 'No mod', deltas: {} }],
        tuningOptions: [{ id: 'none', name: 'No tuning', deltas: {} }],
        ...overrides
    };

    return armor;
}

function inventory(items = slots.map((slot) => item(slot))) {
    return {
        helmet: items.filter((armor) => armor.slot === 'helmet'),
        arms: items.filter((armor) => armor.slot === 'arms'),
        chest: items.filter((armor) => armor.slot === 'chest'),
        legs: items.filter((armor) => armor.slot === 'legs'),
        classItem: items.filter((armor) => armor.slot === 'classItem')
    };
}

function mod(stat: ArmorStat, value: 5 | 10) {
    return createAdjustment(`stat-mod:${stat}:${value}`, `+${value} ${stat}`, { [stat]: value });
}

function tuning(increased: ArmorStat, decreased: ArmorStat) {
    return createAdjustment(`tuning:${increased}:plus5:${decreased}:minus5`, `+5 ${increased}, -5 ${decreased}`, {
        [increased]: 5,
        [decreased]: -5
    });
}

function realBuildItem(
    slot: ArmorSlot,
    name: string,
    baseStats: StatVector,
    choices: [statMod: ReturnType<typeof mod>, tuning: ReturnType<typeof tuning>]
) {
    return item(slot, {
        name,
        classType: 'warlock',
        tier: 5,
        baseStats,
        statModOptions: [{ id: 'none', name: 'No mod', deltas: {} }, choices[0]],
        tuningOptions: [{ id: 'none', name: 'No tuning', deltas: {} }, choices[1]]
    });
}

describe('solveArmor', () => {
    test('matches exact stat targets', () => {
        const result = solveArmor({
            characterId: 'hunter',
            classType: 'hunter',
            statTargets: { health: 50, melee: 50, grenade: 50, super: 50, class: 50, weapons: 50 },
            setRequirements: [],
            armor: inventory()
        });

        expect(result.ok).toBe(true);
        expect(result.ok && result.builds[0]?.stats.health).toBe(50);
    });

    test('uses stat mods to reach requested targets', () => {
        const result = solveArmor({
            characterId: 'hunter',
            classType: 'hunter',
            statTargets: { health: 60 },
            setRequirements: [],
            armor: inventory([
                item('helmet', { statModOptions: createDefaultStatModOptions() }),
                ...slots.slice(1).map((slot) => item(slot))
            ])
        });

        expect(result.ok).toBe(true);
        expect(result.ok && result.builds[0]?.stats.health).toBeGreaterThanOrEqual(60);
    });

    test('offers minor and major stat mod choices', () => {
        const options = createDefaultStatModOptions();

        expect(options.some((option) => option.id === 'stat-mod:weapons:5' && option.deltas.weapons === 5)).toBe(true);
        expect(options.some((option) => option.id === 'stat-mod:weapons:10' && option.deltas.weapons === 10)).toBe(true);
    });

    test('prefers major stat mods in the simple no-tuning path', () => {
        const result = solveArmor({
            characterId: 'hunter',
            classType: 'hunter',
            statTargets: { weapons: 55 },
            setRequirements: [],
            armor: inventory(slots.map((slot) => item(slot, { statModOptions: createDefaultStatModOptions() }))),
            maxResults: 1
        });

        expect(result.ok).toBe(true);
        expect(result.ok && result.builds[0]?.stats.weapons).toBe(60);
        expect(result.ok && result.builds[0]?.pieces.helmet.statMod?.deltas.weapons).toBe(10);
    });

    test('uses minor stat mods when a major stat mod would exceed 200', () => {
        const result = solveArmor({
            characterId: 'hunter',
            classType: 'hunter',
            statTargets: { weapons: 200 },
            setRequirements: [],
            armor: inventory(
                slots.map((slot) =>
                    item(slot, {
                        baseStats: { ...baseStats, weapons: 39 },
                        statModOptions: createDefaultStatModOptions()
                    })
                )
            ),
            maxResults: 1
        });

        expect(result.ok).toBe(true);
        expect(result.ok && result.builds[0]?.stats.weapons).toBe(200);
        expect(result.ok && result.builds[0]?.pieces.helmet.statMod?.deltas.weapons).toBe(5);
    });

    test('applies selected fragment stat bonuses to final stats and target checks', () => {
        const result = solveArmor({
            characterId: 'hunter',
            classType: 'hunter',
            statTargets: { weapons: 60, health: 40 },
            statBonuses: { weapons: 10, health: -10 },
            setRequirements: [],
            armor: inventory()
        });

        expect(result.ok).toBe(true);
        expect(result.ok && result.builds[0]?.stats.weapons).toBe(60);
        expect(result.ok && result.builds[0]?.stats.health).toBe(40);
    });

    test('matches a real tier five masterworked build with tuning mods and stasis fragments', () => {
        const result = solveArmor({
            characterId: 'warlock',
            classType: 'warlock',
            dumpStat: 'health',
            statTargets: {
                health: 20,
                melee: 55,
                grenade: 50,
                super: 120,
                class: 80,
                weapons: 190
            },
            statBonuses: {
                health: 20,
                melee: -20,
                super: 10,
                class: 10
            },
            setRequirements: [],
            armor: inventory([
                realBuildItem('helmet', 'Real Helmet', { health: 5, melee: 5, grenade: 20, super: 25, class: 5, weapons: 30 }, [
                    mod('weapons', 10),
                    tuning('super', 'health')
                ]),
                realBuildItem('arms', 'Real Gauntlets', { health: 5, melee: 20, grenade: 5, super: 25, class: 5, weapons: 30 }, [
                    mod('weapons', 10),
                    tuning('grenade', 'health')
                ]),
                realBuildItem('chest', 'Real Chestpiece', { health: 5, melee: 20, grenade: 5, super: 25, class: 5, weapons: 30 }, [
                    mod('weapons', 10),
                    tuning('grenade', 'health')
                ]),
                realBuildItem('legs', 'Real Legs', { health: 5, melee: 20, grenade: 5, super: 5, class: 30, weapons: 25 }, [
                    mod('weapons', 5),
                    tuning('melee', 'health')
                ]),
                realBuildItem('classItem', 'Real Class Item', { health: 5, melee: 5, grenade: 5, super: 25, class: 20, weapons: 30 }, [
                    mod('weapons', 10),
                    tuning('class', 'health')
                ])
            ]),
            maxResults: 1
        });

        expect(result.ok).toBe(true);
        expect(result.ok && result.builds[0]?.stats).toEqual({
            health: 20,
            melee: 55,
            grenade: 50,
            super: 120,
            class: 80,
            weapons: 190
        });
        expect(result.ok && result.builds[0]?.score.totalStats).toBe(515);
    });

    test('uses pair tuning without a dump stat', () => {
        const tuned = item('helmet', { tier: 5 });
        tuned.tuningOptions = createTierFiveTuningOptions(tuned);

        const result = solveArmor({
            characterId: 'hunter',
            classType: 'hunter',
            statTargets: { health: 55 },
            setRequirements: [],
            armor: inventory([tuned, ...slots.slice(1).map((slot) => item(slot))])
        });

        expect(result.ok).toBe(true);
        expect(result.ok && result.builds[0]?.stats.health).toBeGreaterThanOrEqual(55);
        expect(result.ok && result.builds[0]?.score.totalStats).toBe(result.ok ? statTotal(result.builds[0].stats) : 0);
        expect(result.ok && result.builds[0]?.score.totalStats).toBe(300);
        expect(result.ok && result.builds[0]?.pieces.helmet.tuning?.deltas.health).toBe(5);
        if (result.ok) {
            const decreasedStat = ARMOR_STATS.find((stat) => (result.builds[0]?.pieces.helmet.tuning?.deltas[stat] ?? 0) < 0);
            expect(decreasedStat).toBeDefined();
            expect(decreasedStat ? result.builds[0]?.stats[decreasedStat] : undefined).toBe(45);
        }
    });

    test('uses tier five tuning to reach requested targets when a dump stat is selected', () => {
        const tuned = item('helmet', { tier: 5 });
        tuned.tuningOptions = createTierFiveTuningOptions(tuned);

        const result = solveArmor({
            characterId: 'hunter',
            classType: 'hunter',
            dumpStat: 'melee',
            statTargets: { health: 55 },
            setRequirements: [],
            armor: inventory([tuned, ...slots.slice(1).map((slot) => item(slot))])
        });

        expect(result.ok).toBe(true);
        expect(result.ok && result.builds[0]?.stats.health).toBeGreaterThanOrEqual(55);
        expect(result.ok && result.builds[0]?.pieces.helmet.tuning?.deltas.health).toBe(5);
    });

    test('uses balanced tuning only when explicitly allowed', () => {
        const balancedOnly = item('helmet', {
            tier: 5,
            tuningOptions: [
                { id: 'tuning:none', name: 'No tuning', deltas: {} },
                { id: 'tuning:balanced', name: 'Balanced Tuning', deltas: { health: 1, melee: 1, grenade: 1 } }
            ]
        });
        const armor = inventory([balancedOnly, ...slots.slice(1).map((slot) => item(slot))]);
        const withoutBalanced = solveArmor({
            characterId: 'hunter',
            classType: 'hunter',
            dumpStat: 'class',
            statTargets: { health: 51 },
            setRequirements: [],
            armor
        });
        const withBalanced = solveArmor({
            characterId: 'hunter',
            classType: 'hunter',
            dumpStat: 'class',
            allowBalancedTuning: true,
            statTargets: { health: 51 },
            setRequirements: [],
            armor
        });

        expect(withoutBalanced.ok).toBe(false);
        expect(withBalanced.ok).toBe(true);
        expect(withBalanced.ok && withBalanced.builds[0]?.stats.health).toBe(51);
        expect(withBalanced.ok && withBalanced.builds[0]?.stats.melee).toBe(51);
        expect(withBalanced.ok && withBalanced.builds[0]?.stats.grenade).toBe(51);
        expect(withBalanced.ok && withBalanced.builds[0]?.score.totalStats).toBe(303);
        expect(withBalanced.ok && withBalanced.builds[0]?.pieces.helmet.tuning?.id).toBe('tuning:balanced');
    });

    test('does not select zero-effect balanced tuning as a no-op', () => {
        const zeroBalanced = item('helmet', {
            tier: 5,
            statModOptions: createDefaultStatModOptions(),
            tuningOptions: [
                { id: 'tuning:none', name: 'No tuning', deltas: {} },
                { id: 'tuning:balanced-zero', name: 'Balanced Tuning', deltas: {} }
            ]
        });
        const nonSimpleArms = item('arms', { statModOptions: [{ id: 'none', name: 'No mod', deltas: {} }] });

        const result = solveArmor({
            characterId: 'hunter',
            classType: 'hunter',
            dumpStat: 'class',
            allowBalancedTuning: true,
            statTargets: { health: 60 },
            setRequirements: [],
            armor: inventory([zeroBalanced, nonSimpleArms, ...slots.slice(2).map((slot) => item(slot))])
        });

        expect(result.ok).toBe(true);
        expect(result.ok && result.builds[0]?.pieces.helmet.statMod?.deltas.health).toBe(10);
        expect(result.ok && result.builds[0]?.pieces.helmet.tuning?.id).toBe('tuning:none');
    });

    test('uses pair tuning only when it subtracts the selected dump stat', () => {
        const wrongPenaltyOnly = item('helmet', {
            tier: 5,
            tuningOptions: [
                { id: 'tuning:none', name: 'No tuning', deltas: {} },
                { id: 'tuning:health:minus-melee', name: '+Health / -Melee', deltas: { health: 5, melee: -5 } }
            ]
        });
        const correctPenalty = item('helmet', {
            tier: 5,
            tuningOptions: [
                { id: 'tuning:none', name: 'No tuning', deltas: {} },
                { id: 'tuning:health:minus-class', name: '+Health / -Class', deltas: { health: 5, class: -5 } }
            ]
        });
        const wrongPenaltyResult = solveArmor({
            characterId: 'hunter',
            classType: 'hunter',
            dumpStat: 'class',
            statTargets: { health: 55 },
            setRequirements: [],
            armor: inventory([wrongPenaltyOnly, ...slots.slice(1).map((slot) => item(slot))])
        });
        const correctPenaltyResult = solveArmor({
            characterId: 'hunter',
            classType: 'hunter',
            dumpStat: 'class',
            statTargets: { health: 55 },
            setRequirements: [],
            armor: inventory([correctPenalty, ...slots.slice(1).map((slot) => item(slot))])
        });

        expect(wrongPenaltyResult.ok).toBe(false);
        expect(correctPenaltyResult.ok).toBe(true);
        expect(correctPenaltyResult.ok && correctPenaltyResult.builds[0]?.pieces.helmet.tuning?.id).toBe('tuning:health:minus-class');
    });

    test('uses the dump stat as the preferred tuning penalty', () => {
        const tuned = item('helmet', { tier: 5 });
        tuned.tuningOptions = createTierFiveTuningOptions(tuned);

        const result = solveArmor({
            characterId: 'hunter',
            classType: 'hunter',
            dumpStat: 'health',
            statTargets: { health: 50, melee: 50, grenade: 50, super: 50, class: 50, weapons: 55 },
            setRequirements: [],
            armor: inventory([tuned, ...slots.slice(1).map((slot) => item(slot))])
        });

        expect(result.ok).toBe(true);
        expect(result.ok && result.builds[0]?.stats.weapons).toBe(55);
        expect(result.ok && result.builds[0]?.pieces.helmet.tuning?.deltas).toEqual({ weapons: 5, health: -5 });
    });

    test('enforces set requirements', () => {
        const set = { id: 'set-a', name: 'Set A' };
        const result = solveArmor({
            characterId: 'hunter',
            classType: 'hunter',
            statTargets: {},
            setRequirements: [{ setId: set.id, requiredPieces: 4 }],
            armor: inventory(slots.map((slot, index) => item(slot, index < 4 ? { set } : {})))
        });

        expect(result.ok).toBe(true);
        expect(result.ok && result.builds[0]?.activeSetBonuses[0]?.activeBonuses).toEqual([2, 4]);
    });

    test('enforces chosen exotic type and tries each roll', () => {
        const exoticHash = 12345;
        const weakerExotic = item('helmet', {
            itemInstanceId: 'chosen-exotic-weak',
            itemHash: exoticHash,
            isExotic: true,
            baseStats: { ...baseStats, health: 10 }
        });
        const strongerExotic = item('helmet', {
            itemInstanceId: 'chosen-exotic-strong',
            itemHash: exoticHash,
            isExotic: true,
            baseStats: { ...baseStats, health: 40 }
        });
        const result = solveArmor({
            characterId: 'hunter',
            classType: 'hunter',
            selectedExoticItemHash: exoticHash,
            statTargets: { health: 80 },
            setRequirements: [],
            armor: inventory([weakerExotic, strongerExotic, ...slots.slice(1).map((slot) => item(slot))])
        });

        expect(result.ok).toBe(true);
        expect(result.ok && result.builds[0]?.pieces.helmet.item.itemInstanceId).toBe('chosen-exotic-strong');
    });

    test('retains the top capped results for the requested sort', () => {
        const lowerHealth = item('helmet', {
            itemInstanceId: 'first-low-health',
            baseStats: { ...baseStats, health: 10 }
        });
        const higherHealth = item('helmet', {
            itemInstanceId: 'second-high-health',
            baseStats: { ...baseStats, health: 40 }
        });

        const result = solveArmor({
            characterId: 'hunter',
            classType: 'hunter',
            statTargets: {},
            setRequirements: [],
            armor: inventory([lowerHealth, higherHealth, ...slots.slice(1).map((slot) => item(slot))]),
            maxResults: 1,
            resultSort: { key: 'health', direction: 'desc' }
        });

        expect(result.ok).toBe(true);
        expect(result.validBuildCount).toBe(2);
        expect(result.returnedBuildCount).toBe(1);
        expect(result.ok && result.builds[0]?.pieces.helmet.item.itemInstanceId).toBe('second-high-health');
    });

    test('keeps valid build counts stable across result sorts', () => {
        const tuned = item('helmet', { tier: 5 });
        tuned.tuningOptions = createTierFiveTuningOptions(tuned);
        const armor = inventory([tuned, ...slots.slice(1).map((slot) => item(slot))]);
        const descending = solveArmor({
            characterId: 'hunter',
            classType: 'hunter',
            dumpStat: 'health',
            statTargets: { super: 55 },
            setRequirements: [],
            armor,
            resultSort: { key: 'super', direction: 'desc' }
        });
        const ascending = solveArmor({
            characterId: 'hunter',
            classType: 'hunter',
            dumpStat: 'health',
            statTargets: { super: 55 },
            setRequirements: [],
            armor,
            resultSort: { key: 'super', direction: 'asc' }
        });

        expect(descending.ok).toBe(true);
        expect(ascending.ok).toBe(true);
        expect(descending.validBuildCount).toBe(ascending.validBuildCount);
        expect(descending.searchedCombinations).toBe(ascending.searchedCombinations);
    });

    test('returns no solution when targets are impossible', () => {
        const result = solveArmor({
            characterId: 'hunter',
            classType: 'hunter',
            statTargets: { health: 200 },
            setRequirements: [],
            armor: inventory()
        });

        expect(result.ok).toBe(false);
    });

    test('calculates target caps with the same balanced tuning rules as solving', () => {
        const balancedOnly = item('helmet', {
            tier: 5,
            tuningOptions: [
                { id: 'tuning:none', name: 'No tuning', deltas: {} },
                { id: 'tuning:balanced', name: 'Balanced Tuning', deltas: { health: 1, melee: 1, grenade: 1 } }
            ]
        });
        const armor = inventory([balancedOnly, ...slots.slice(1).map((slot) => item(slot))]);
        const withoutBalancedInput = {
            characterId: 'hunter',
            classType: 'hunter',
            dumpStat: 'class',
            statTargets: {},
            setRequirements: [],
            armor
        } as const;
        const withBalancedInput = {
            characterId: 'hunter',
            classType: 'hunter',
            dumpStat: 'class',
            allowBalancedTuning: true,
            statTargets: {},
            setRequirements: [],
            armor
        } as const;
        const withoutBalanced = calculateArmorStatTargetCaps(withoutBalancedInput);
        const withBalanced = calculateArmorStatTargetCaps(withBalancedInput);

        expect(withoutBalanced.health).toBe(50);
        expect(calculateArmorStatTargetCap(withoutBalancedInput, 'health')).toBe(withoutBalanced.health);
        expect(withoutBalanced.class).toBe(0);
        expect(withBalanced.health).toBe(51);
    });

    test('target caps report final displayed stat values instead of threshold values', () => {
        const armor = inventory([
            item('helmet', { baseStats: { ...baseStats, melee: 0 }, statModOptions: createDefaultStatModOptions() }),
            ...slots.slice(1).map((slot) => item(slot, { baseStats: { ...baseStats, melee: 0 } }))
        ]);
        const input = {
            characterId: 'hunter',
            classType: 'hunter',
            statTargets: { melee: 9 },
            setRequirements: [],
            armor
        } as const;
        const result = solveArmor({
            ...input,
            maxResults: 1
        });

        expect(result.ok && result.builds[0]?.stats.melee).toBe(10);
        expect(calculateArmorStatTargetCap(input, 'melee')).toBe(10);
    });
});
