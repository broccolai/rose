import type { InteractiveBenchmarkScenario } from './types';

const seventhSeraphSetId = 'equipable:222121557';

export const interactiveBenchmarkScenarios: InteractiveBenchmarkScenario[] = [
    {
        id: 'warlock-open-dump-health',
        name: 'Warlock, no exotic, Health dump',
        classType: 'warlock',
        dumpStat: 'health',
        targets: { grenade: 140, weapons: 170 },
        priorityStat: 'grenade',
        sliderSteps: [
            { stat: 'grenade', value: 50 },
            { stat: 'grenade', value: 140 },
            { stat: 'grenade', value: 200 }
        ],
        synthesizeModernOptions: true,
        syntheticTuningItemsPerSlot: 1,
        maxResults: 5_000
    },
    {
        id: 'warlock-nezarec-high-targets',
        name: "Warlock, Nezarec's Sin, high Melee + Weapons",
        classType: 'warlock',
        selectedExoticItemHash: 925466716,
        dumpStat: 'class',
        targets: { health: 20, melee: 100, weapons: 200 },
        priorityStat: 'melee',
        sliderSteps: [
            { stat: 'melee', value: 100 },
            { stat: 'melee', value: 120 },
            { stat: 'melee', value: 135 },
            { stat: 'melee', value: 140 }
        ],
        synthesizeModernOptions: true,
        syntheticTuningItemsPerSlot: 1,
        maxResults: 5_000
    },
    {
        id: 'warlock-tsteps-seventh-seraph-two-piece',
        name: 'Warlock, Transversive Steps, Seventh Seraph 2pc',
        classType: 'warlock',
        selectedExoticItemHash: 3337759189,
        dumpStat: 'health',
        targets: { super: 175, weapons: 100 },
        priorityStat: 'super',
        sliderSteps: [
            { stat: 'super', value: 100 },
            { stat: 'super', value: 150 },
            { stat: 'super', value: 180 }
        ],
        setRequirements: [{ setId: seventhSeraphSetId, requiredPieces: 2 }],
        synthesizeModernOptions: true,
        syntheticTuningItemsPerSlot: 1,
        maxResults: 5_000
    },
    {
        id: 'hunter-fortunes-favor-fragments',
        name: "Hunter, Fortune's Favor, fragment bonuses",
        classType: 'hunter',
        selectedExoticItemHash: 4010324161,
        dumpStat: 'health',
        statBonuses: { health: 10, super: 10 },
        targets: { super: 180, weapons: 75 },
        priorityStat: 'weapons',
        sliderSteps: [
            { stat: 'weapons', value: 50 },
            { stat: 'weapons', value: 75 },
            { stat: 'weapons', value: 100 }
        ],
        synthesizeModernOptions: true,
        syntheticTuningItemsPerSlot: 1,
        maxResults: 5_000
    },
    {
        id: 'warlock-seventh-seraph-four-piece',
        name: 'Warlock, Seventh Seraph 4pc',
        classType: 'warlock',
        dumpStat: 'health',
        targets: { super: 100, weapons: 150 },
        priorityStat: 'weapons',
        sliderSteps: [
            { stat: 'weapons', value: 100 },
            { stat: 'weapons', value: 150 },
            { stat: 'weapons', value: 180 }
        ],
        setRequirements: [{ setId: seventhSeraphSetId, requiredPieces: 4 }],
        synthesizeModernOptions: true,
        syntheticTuningItemsPerSlot: 1,
        maxResults: 5_000
    },
    {
        id: 'titan-no-dump',
        name: 'Titan, no exotic, no dump stat',
        classType: 'titan',
        targets: { grenade: 100, weapons: 150 },
        priorityStat: 'grenade',
        sliderSteps: [
            { stat: 'grenade', value: 50 },
            { stat: 'grenade', value: 100 },
            { stat: 'grenade', value: 150 }
        ],
        synthesizeModernOptions: true,
        syntheticTuningItemsPerSlot: 1,
        maxResults: 5_000
    },
    {
        id: 'warlock-balanced-tuning',
        name: 'Warlock, balanced tuning enabled',
        benchmarkTier: 'stress',
        classType: 'warlock',
        dumpStat: 'health',
        allowBalancedTuning: true,
        targets: { grenade: 100, super: 100, weapons: 150 },
        priorityStat: 'super',
        sliderSteps: [
            { stat: 'super', value: 50 },
            { stat: 'super', value: 75 },
            { stat: 'super', value: 100 }
        ],
        synthesizeModernOptions: true,
        syntheticTuningItemsPerSlot: 1,
        maxResults: 5_000
    },
    {
        id: 'warlock-no-dump-balanced-stress',
        name: 'Warlock, no dump, balanced tuning stress',
        benchmarkTier: 'stress',
        classType: 'warlock',
        allowBalancedTuning: true,
        targets: { grenade: 140, weapons: 170 },
        priorityStat: 'grenade',
        sliderSteps: [
            { stat: 'grenade', value: 100 },
            { stat: 'grenade', value: 140 }
        ],
        synthesizeModernOptions: true,
        syntheticTuningItemsPerSlot: 6,
        maxResults: 5_000
    },
    {
        id: 'hunter-stompees-health-dump-high-weapons',
        name: 'Hunter, St0mp-EE5, Health dump, 180 Weapons',
        benchmarkTier: 'stress',
        classType: 'hunter',
        selectedExoticItemHash: 2405271937,
        dumpStat: 'health',
        allowBalancedTuning: true,
        statBonuses: { health: 20, super: 10, class: 10 },
        targets: { weapons: 180 },
        priorityStat: 'grenade',
        sliderStepMode: 'independent',
        sliderSteps: [
            { stat: 'melee', value: 25 },
            { stat: 'grenade', value: 25 },
            { stat: 'super', value: 25 },
            { stat: 'class', value: 25 }
        ],
        synthesizeModernOptions: true,
        syntheticTuningItemsPerSlot: 1,
        maxResults: 5_000
    },
    {
        id: 'hunter-stompees-health-dump-two-high-stats',
        name: 'Hunter, St0mp-EE5, Health dump, 180 Weapons + 150 Super',
        benchmarkTier: 'stress',
        classType: 'hunter',
        selectedExoticItemHash: 2405271937,
        dumpStat: 'health',
        allowBalancedTuning: true,
        statBonuses: { health: 20, super: 10, class: 10 },
        targets: { super: 150, weapons: 180 },
        priorityStat: 'grenade',
        sliderStepMode: 'independent',
        sliderSteps: [
            { stat: 'melee', value: 25 },
            { stat: 'grenade', value: 25 },
            { stat: 'class', value: 25 }
        ],
        synthesizeModernOptions: true,
        syntheticTuningItemsPerSlot: 1,
        maxResults: 5_000
    }
];
