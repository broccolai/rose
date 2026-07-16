import { describe, expect, test } from 'bun:test';

import { decodeWeaponScenario, decodeWeaponSelection, encodeWeaponSelection } from '@/features/weapons/selection-url';

describe('weapon selection URL codec', () => {
    test('round trips plugs and active effect values', () => {
        const selection = {
            weaponHash: 882778888,
            plugs: { '1': 3250034553, '3': 247725512 },
            effects: { '247725512': 5 }
        };
        expect(decodeWeaponSelection(encodeWeaponSelection(selection))).toEqual(selection);
    });

    test('rejects malformed or out-of-range values', () => {
        expect(decodeWeaponSelection(new URLSearchParams('w=oops'))).toBeNull();
        expect(decodeWeaponSelection(new URLSearchParams('w=882778888&p=1:nope,2:5000000000'))).toEqual({
            weaponHash: 882778888,
            plugs: {},
            effects: {}
        });
    });

    test('round trips the calculation scenario and sanitizes its bounds', () => {
        const params = encodeWeaponSelection({ weaponHash: 1, plugs: {}, effects: {} }, { mode: 'pve', overshield: 40, weaponsStat: 175 });
        expect(decodeWeaponScenario(params)).toEqual({ mode: 'pve', overshield: 40, weaponsStat: 175 });
        expect(decodeWeaponScenario(new URLSearchParams('m=nope&hp=999&os=-1&ws=201'))).toEqual({
            mode: 'pvp',
            overshield: 0,
            weaponsStat: 100
        });
    });
});
