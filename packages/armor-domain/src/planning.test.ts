import { describe, expect, test } from 'bun:test';

import { ARMOR_ARCHETYPES, ARMOR_ROLL_PROFILES } from './planning';
import { ARMOR_STATS } from './types';

describe('Armor 3.0 planning profiles', () => {
    test('models twelve archetypes and their four legal tertiary rolls', () => {
        expect(ARMOR_ARCHETYPES).toHaveLength(12);
        expect(ARMOR_ROLL_PROFILES).toHaveLength(48);

        for (const archetype of ARMOR_ARCHETYPES) {
            const rolls = ARMOR_ROLL_PROFILES.filter((roll) => roll.archetype.id === archetype.id);
            expect(rolls).toHaveLength(4);
            expect(new Set(rolls.map((roll) => roll.tertiaryStat)).size).toBe(4);
        }
    });

    test('keeps every fully masterworked Tier 5 base roll at the legal 90-stat shape', () => {
        for (const roll of ARMOR_ROLL_PROFILES) {
            const values = ARMOR_STATS.map((stat) => roll.baseStats[stat]).sort((left, right) => left - right);
            const total = values.reduce((sum, value) => sum + value, 0);

            expect(values).toEqual([5, 5, 5, 20, 25, 30]);
            expect(total).toBe(90);
        }
    });
});
