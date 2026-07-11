import { describe, expect, test } from 'bun:test';
import { ARMOR_SLOTS, type ArmorItem, type ArmorSlot, createDefaultStatModOptions, NO_TUNING } from '../../armor-calc/src';
import { hasBenchmarkInputs, loadLatestBenchmarkBundle } from './bundle';
import { runInteractiveScenarioBenchmark } from './interactive-suite';
import { runComparisonBenchmarks } from './run';
import { defaultBenchmarkScenarios } from './scenarios';
import type { InteractiveBenchmarkScenario, LoadedBenchmarkBundle } from './types';

describe('interactive workload benchmarks', () => {
    test('measures solve, slider, combined cap, UI refresh, and slider sequence workloads', () => {
        const scenario: InteractiveBenchmarkScenario = {
            id: 'micro-workload',
            name: 'Micro workload',
            classType: 'warlock',
            dumpStat: 'health',
            targets: { grenade: 50, weapons: 100 },
            priorityStat: 'grenade',
            sliderSteps: [
                { stat: 'grenade', value: 25 },
                { stat: 'grenade', value: 50 }
            ],
            disableTuning: true,
            maxResults: 100
        };
        const result = runInteractiveScenarioBenchmark(microBenchmarkBundle(), scenario, {
            iterations: 1,
            warmupIterations: 0
        });

        expect(result.itemCount).toBe(15);
        expect(result.rawSlotProduct).toBe(243);
        expect(result.singleSlider.coldValue).toBeGreaterThan(0);
        expect(result.combinedSliders.coldValue.weapons).toBeGreaterThanOrEqual(100);
        expect(result.uiSliderRefresh.coldValue.priorityCap).toBe(result.singleSlider.coldValue);
        expect(result.sliderSequence.coldValue.steps).toHaveLength(2);
        expect(result.sliderSequence.coldValue.steps.every((step) => step.elapsedMs >= 0)).toBe(true);
        expect(result.sliderSequence.warm.samplesMs).toHaveLength(0);
        expect(result.solve.coldValue.ok).toBe(true);
        expect(result.solve.coldValue.returnedBuildCount).toBeGreaterThan(0);
        expect(result.solve.warm.samplesMs).toHaveLength(1);
    });

    test('can probe slider changes independently from the same target baseline', () => {
        const scenario: InteractiveBenchmarkScenario = {
            id: 'independent-slider-probes',
            name: 'Independent slider probes',
            classType: 'warlock',
            dumpStat: 'health',
            targets: { weapons: 100 },
            priorityStat: 'grenade',
            sliderStepMode: 'independent',
            sliderSteps: [
                { stat: 'melee', value: 25 },
                { stat: 'grenade', value: 50 }
            ],
            disableTuning: true,
            maxResults: 100
        };
        const result = runInteractiveScenarioBenchmark(microBenchmarkBundle(), scenario, {
            iterations: 1,
            warmupIterations: 0
        });

        expect(result.sliderSequence.coldValue.steps).toHaveLength(2);
        expect(result.sliderSequence.coldValue.finalTargets.melee).toBe(0);
        expect(result.sliderSequence.coldValue.finalTargets.grenade).toBe(50);
        expect(result.sliderSequence.coldValue.finalTargets.weapons).toBe(100);
    });
});

const maybeDescribe = hasBenchmarkInputs() ? describe : describe.skip;

maybeDescribe('D2ArmorPicker comparison benchmarks', () => {
    test('Rose and one-worker D2AP agree on multiple result-returning loaded-vault scenarios', async () => {
        const bundle = loadLatestBenchmarkBundle();
        const results = await runComparisonBenchmarks(bundle, defaultBenchmarkScenarios);

        expect(results).toHaveLength(defaultBenchmarkScenarios.length);

        for (const result of results) {
            expect(result.d2ap.checkedCalculations).toBeGreaterThanOrEqual(result.d2ap.computedPermutations);
            expect(result.rose.resultCount).toBe(result.d2ap.computedPermutations);
            expect(result.rose.returnedBuildCount).toBe(Math.min(result.rose.resultCount, 30_000));
            expect(result.rose.ok).toBe(true);
            expect(result.rose.resultCount).toBeGreaterThan(0);
        }

        expect(results.find((result) => result.scenario.id === 'warlock-tsteps-weapons-200')?.rose.resultCount).toBe(1050);
        expect(results.find((result) => result.scenario.id === 'warlock-tsteps-weapons-100-super-100')?.rose.resultCount).toBe(349203);
        expect(results.find((result) => result.scenario.id === 'warlock-tsteps-super-180-two-piece')?.rose.resultCount).toBe(84);
    }, 30_000);
});

function microBenchmarkBundle(): LoadedBenchmarkBundle {
    return {
        normalizedProfile: {
            armor: ARMOR_SLOTS.flatMap((slot) => [0, 1, 2].map((index) => microArmorItem(slot, index)))
        }
    };
}

function microArmorItem(slot: ArmorSlot, index: number): ArmorItem {
    return {
        itemInstanceId: `${slot}-${index}`,
        itemHash: ARMOR_SLOTS.indexOf(slot) * 10 + index + 1,
        name: `${slot} ${index}`,
        slot,
        classType: 'warlock',
        isExotic: false,
        baseStats: {
            health: index,
            melee: 5 + index,
            grenade: 10 + index,
            super: 15 - index,
            class: 5,
            weapons: 20 - index
        },
        statModOptions: createDefaultStatModOptions(),
        tuningOptions: [NO_TUNING]
    };
}
