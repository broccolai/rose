import { describe, expect, test } from 'bun:test';

import { clampWeaponEffectValue, normalizeWeaponEffectOptions } from '@/features/weapons/oracle-engine';
import type { WeaponEffectOption } from '@/features/weapons/types';

const option = (value: Partial<WeaponEffectOption>): WeaponEffectOption => ({
    stacks: [0, 0],
    options: [],
    optionType: 'STATIC',
    ...value
});

describe('weapon effect values', () => {
    test('normalizes toggles to zero or one', () => {
        const toggle = option({ optionType: 'TOGGLE', stacks: [0, 1] });
        expect(clampWeaponEffectValue(toggle, -1)).toBe(0);
        expect(clampWeaponEffectValue(toggle, 14)).toBe(1);
    });

    test('clamps option indexes and slider stacks', () => {
        const choices = option({ optionType: 'OPTIONS', stacks: [0, 2], options: ['None', 'Base', 'Max'] });
        const slider = option({ optionType: 'SLIDER', stacks: [1, 5] });
        expect(clampWeaponEffectValue(choices, 99)).toBe(2);
        expect(clampWeaponEffectValue(choices, Number.NaN)).toBe(0);
        expect(clampWeaponEffectValue(slider, -5)).toBe(1);
        expect(clampWeaponEffectValue(slider, 3.9)).toBe(3);
        expect(clampWeaponEffectValue(slider, 20)).toBe(5);
    });

    test('drops static and unknown effect values', () => {
        expect(clampWeaponEffectValue(option({ optionType: 'STATIC' }), 1)).toBe(0);
        expect(clampWeaponEffectValue(undefined, 1)).toBe(0);
    });

    test('preserves Oracle modeling limitations on conditional options', () => {
        expect(
            normalizeWeaponEffectOptions(
                new Map([
                    [
                        1_517_798_362,
                        {
                            stacks: [0, 3],
                            options: ['None', 'Low health', 'Critical', 'Near death'],
                            optionType: 'OPTIONS',
                            modelingNote: '  Shields are ignored; Aim Assist is not calculated.  '
                        }
                    ]
                ])
            )['1517798362']
        ).toEqual({
            stacks: [0, 3],
            options: ['None', 'Low health', 'Critical', 'Near death'],
            optionType: 'OPTIONS',
            modelingNote: 'Shields are ignored; Aim Assist is not calculated.'
        });
    });
});
