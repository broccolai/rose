import { describe, expect, test } from 'bun:test';

import { armorStatEffectsAt } from '@/features/armor/stat-effects';

describe('armor stat effects', () => {
    test('scales health effects across both stat ranges', () => {
        expect(armorStatEffectsAt('health', 50).effects).toContainEqual({ label: 'Orb pickup healing', value: '35 HP' });
        expect(armorStatEffectsAt('health', 150).effects).toContainEqual({ label: 'PvE shield capacity', value: '+10 HP' });
    });

    test('scales enhanced ability damage above 100', () => {
        expect(armorStatEffectsAt('melee', 150).effects).toContainEqual({ label: 'Melee ability damage', value: '+15%' });
        expect(armorStatEffectsAt('grenade', 140).effects).toContainEqual({ label: 'Grenade ability damage', value: '+26%' });
        expect(armorStatEffectsAt('super', 125).effects).toContainEqual({ label: 'Super ability damage', value: '+11.3%' });
    });

    test('shows the class overshield at the selected value', () => {
        expect(armorStatEffectsAt('class', 150).effects).toContainEqual({
            label: 'Class ability overshield',
            value: '20 HP PvE / 5 HP PvP'
        });
    });

    test('clamps values to the supported 0-200 range', () => {
        expect(armorStatEffectsAt('weapons', 250).heading).toBe('Weapons at 200');
    });
});
