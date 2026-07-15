import { describe, expect, test } from 'bun:test';

import { isObservedWeaponMasterwork, isPlugAllowedBySocketType, masterworkFamilyKey, masterworkStatName } from './weapon-catalog-rules';

describe('weapon catalog socket rules', () => {
    test('keeps only plug categories whitelisted by the weapon socket', () => {
        expect(isPlugAllowedBySocketType(10, [10, 20], false)).toBe(true);
        expect(isPlugAllowedBySocketType(30, [10, 20], false)).toBe(false);
    });

    test('honors Bungie socket types with an empty universal whitelist', () => {
        expect(isPlugAllowedBySocketType(30, [], false)).toBe(true);
    });

    test('retains the socket initial plug for a valid default', () => {
        expect(isPlugAllowedBySocketType(30, [10, 20], true)).toBe(true);
    });

    test('derives legal masterwork stats from real initial rolls in the same weapon family', () => {
        const observed = new Map([
            [masterworkFamilyKey('Hand Cannon', 'Adaptive Frame'), new Set(['Handling', 'Range'])],
            [masterworkFamilyKey('Hand Cannon', 'Dynamic Heat Weapon'), new Set(['Cooling Efficiency', 'Vent Speed'])]
        ]);
        expect(masterworkStatName('Tier 1: Handling')).toBe('Handling');
        expect(isObservedWeaponMasterwork(observed, 'Hand Cannon', 'Adaptive Frame', 'Masterworked: Range')).toBe(true);
        expect(isObservedWeaponMasterwork(observed, 'Hand Cannon', 'Adaptive Frame', 'Masterworked: Impact')).toBe(false);
        expect(isObservedWeaponMasterwork(observed, 'Hand Cannon', 'Dynamic Heat Weapon', 'Masterworked: Vent Speed')).toBe(true);
    });
});
