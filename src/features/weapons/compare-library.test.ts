import { describe, expect, test } from 'bun:test';

import {
    addWeaponCompare,
    MAX_COMPARE_ROLLS,
    readWeaponCompare,
    WEAPON_COMPARE_KEY,
    writeWeaponCompare
} from '@/features/weapons/compare-library';
import { DEFAULT_WEAPON_SCENARIO } from '@/features/weapons/selection-url';
import type { SavedWeaponRoll } from '@/features/weapons/types';

function roll(id: string): SavedWeaponRoll {
    return {
        id,
        selection: { weaponHash: 1, plugs: { '2': 3 }, effects: {} },
        weaponName: 'Rose',
        icon: '/rose.jpg',
        subtitle: 'Hand Cannon',
        perkNames: ['Perpetual Motion'],
        stats: { Range: 60 },
        optimalTtk: 0.87,
        range: 32.5,
        scenario: { ...DEFAULT_WEAPON_SCENARIO },
        engineVersion: 'test',
        savedAt: 1
    };
}

describe('weapon compare persistence', () => {
    test('rejects malformed nested selections and metrics', () => {
        const malformed = { ...roll('bad'), selection: { weaponHash: 1 }, optimalTtk: 'fast' };
        const storage = { getItem: () => JSON.stringify([malformed]), setItem: () => undefined };
        expect(readWeaponCompare(storage)).toEqual([]);
    });

    test('migrates legacy rolls to the default scenario', () => {
        const legacy = { ...roll('legacy'), scenario: undefined };
        const storage = { getItem: () => JSON.stringify([legacy]), setItem: () => undefined };
        expect(readWeaponCompare(storage)[0]?.scenario).toEqual(DEFAULT_WEAPON_SCENARIO);
    });

    test('reports quota failures without throwing', () => {
        const storage = {
            getItem: () => null,
            setItem: () => {
                throw new DOMException('Quota exceeded', 'QuotaExceededError');
            }
        };
        expect(writeWeaponCompare([roll('one')], storage)).toBe(false);
    });

    test('deduplicates newest rolls and enforces the six-roll cap', () => {
        const rolls = Array.from({ length: MAX_COMPARE_ROLLS }, (_, index) => roll(String(index)));
        const next = addWeaponCompare(rolls, { ...roll('3'), savedAt: 2 });
        expect(next).toHaveLength(MAX_COMPARE_ROLLS);
        expect(next.map((candidate) => candidate.id)).toEqual(['3', '0', '1', '2', '4', '5']);
    });

    test('writes the versioned storage key', () => {
        let key = '';
        const storage = { getItem: () => null, setItem: (nextKey: string) => (key = nextKey) };
        expect(writeWeaponCompare([roll('one')], storage)).toBe(true);
        expect(key).toBe(WEAPON_COMPARE_KEY);
    });
});
