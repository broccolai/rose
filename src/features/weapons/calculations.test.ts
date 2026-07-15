import { describe, expect, test } from 'bun:test';

import { weaponsStatDamageScalar } from '@/features/weapons/calculations';

describe('weaponsStatDamageScalar', () => {
    test('maps the verified Armor 3.0 PvP range linearly', () => {
        expect(weaponsStatDamageScalar(100)).toBe(1);
        expect(weaponsStatDamageScalar(150)).toBeCloseTo(1.03);
        expect(weaponsStatDamageScalar(200)).toBeCloseTo(1.06);
    });

    test('clamps values outside the supported stat range', () => {
        expect(weaponsStatDamageScalar(0)).toBe(1);
        expect(weaponsStatDamageScalar(300)).toBeCloseTo(1.06);
    });
});
