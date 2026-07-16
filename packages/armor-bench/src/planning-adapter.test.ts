import { describe, expect, test } from 'bun:test';

import { BenchmarkArmorPlanner } from './wasm-engine';

describe('Rust/Wasm armor planner', () => {
    test('loads the legal roll catalog and finds an exact high-stat farming recipe', () => {
        const planner = new BenchmarkArmorPlanner();

        try {
            expect(planner.measurements.summary.rollCount).toBe(48);
            expect(
                planner.calculateCap(
                    {
                        dumpStat: 'health',
                        allowBalancedTuning: false,
                        statTargets: { weapons: 200 },
                        statBonuses: {}
                    },
                    'super'
                )
            ).toBe(150);

            const result = planner.plan({
                dumpStat: 'health',
                allowBalancedTuning: false,
                statTargets: { weapons: 200, super: 150 },
                statBonuses: {},
                maxResults: 5
            });

            expect(result.ok).toBe(true);
            if (!result.ok) {
                return;
            }

            expect(result.plans).toHaveLength(5);
            expect(result.plans.every((plan) => plan.stats.weapons === 200)).toBe(true);
            expect(result.plans.every((plan) => plan.stats.super === 150)).toBe(true);
            expect(
                result.plans.every((plan) => Object.values(plan.pieces).every((piece) => piece.roll.archetype.id === 'powerhouse'))
            ).toBe(true);
        } finally {
            planner.dispose();
        }
    });
});
