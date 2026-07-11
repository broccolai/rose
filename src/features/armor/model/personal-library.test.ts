import { describe, expect, test } from 'bun:test';

import { ARMOR_SLOTS, type ArmorBuild, type ArmorSlot, type StatVector } from '@armor-calc';
import {
    isArmorBuildSaved,
    readPersonalArmorLibrary,
    removeSavedArmorBuild,
    sanitizePersonalArmorLibrary,
    saveArmorBuild,
    toggleFavoriteExotic,
    writePersonalArmorLibrary
} from './personal-library';

const storage = () => {
    const values = new Map<string, string>();
    return {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value)
    };
};

const zeroStats = (): StatVector => ({ health: 0, melee: 0, grenade: 0, super: 0, class: 0, weapons: 0 });

const makeBuild = (helmetId = 'helmet'): ArmorBuild => ({
    pieces: Object.fromEntries(
        ARMOR_SLOTS.map((slot) => [
            slot,
            {
                item: {
                    itemInstanceId: slot === 'helmet' ? helmetId : slot,
                    itemHash: ARMOR_SLOTS.indexOf(slot) + 1,
                    name: slot,
                    slot,
                    classType: 'warlock',
                    isExotic: false,
                    baseStats: zeroStats(),
                    statModOptions: [],
                    tuningOptions: []
                }
            }
        ])
    ) as Record<ArmorSlot, ArmorBuild['pieces'][ArmorSlot]>,
    stats: zeroStats(),
    activeSetBonuses: [],
    score: {
        wastedStats: 0,
        totalStats: 0
    }
});

describe('personal armor library', () => {
    test('toggles favorite exotic hashes without duplicates', () => {
        expect(toggleFavoriteExotic([10, 10], 20)).toEqual([10, 20]);
        expect(toggleFavoriteExotic([10, 20], 10)).toEqual([20]);
    });

    test('saves and removes a build by its stable recipe key', () => {
        const build = makeBuild('saved-helmet');
        const saved = saveArmorBuild([], build, {
            characterId: 'character',
            characterClass: 'warlock',
            savedAt: '2026-07-11T00:00:00.000Z'
        });

        expect(saved).toHaveLength(1);
        expect(isArmorBuildSaved(saved, build)).toBe(true);
        expect(removeSavedArmorBuild(saved, build)).toEqual([]);
    });

    test('round trips valid account-scoped library data', () => {
        const targetStorage = storage();
        const build = makeBuild();
        const library = {
            favoriteExoticItemHashes: [123],
            savedBuilds: saveArmorBuild([], build, {
                characterId: 'character',
                characterClass: 'hunter',
                savedAt: '2026-07-11T00:00:00.000Z'
            })
        };

        writePersonalArmorLibrary('owner', library, targetStorage);
        expect(readPersonalArmorLibrary('owner', targetStorage)).toEqual(library);
        expect(readPersonalArmorLibrary('different-owner', targetStorage).savedBuilds).toEqual([]);
    });

    test('drops malformed persisted values', () => {
        expect(
            sanitizePersonalArmorLibrary({
                favoriteExoticItemHashes: [123, 'bad'],
                savedBuilds: [{ id: 'bad' }]
            })
        ).toEqual({
            favoriteExoticItemHashes: [123],
            savedBuilds: []
        });
    });
});
