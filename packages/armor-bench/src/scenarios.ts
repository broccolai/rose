import type { BenchmarkScenario } from './types';

const benchmarkTwoPieceSet = {
    id: 'benchmark-helmet-arms-set',
    name: 'Benchmark Helmet Arms Set',
    slots: ['helmet', 'arms'] as const
};

export const defaultBenchmarkScenarios: BenchmarkScenario[] = [
    {
        id: 'warlock-tsteps-weapons-200',
        name: 'Warlock weapons 200, Transversive Steps, no tuning',
        classType: 'warlock',
        targets: { weapons: 200 },
        selectedExoticItemHash: 3337759189,
        disableTuning: true,
        maxResults: 30_000
    },
    {
        id: 'warlock-tsteps-weapons-100-super-100',
        name: 'Warlock weapons 100 + super 100, Transversive Steps, no tuning',
        classType: 'warlock',
        targets: { weapons: 100, super: 100 },
        selectedExoticItemHash: 3337759189,
        disableTuning: true,
        maxResults: 30_000
    },
    {
        id: 'warlock-tsteps-super-180-two-piece',
        name: 'Warlock super 180, Transversive Steps, synthetic 2-piece set, no tuning',
        classType: 'warlock',
        targets: { super: 180 },
        selectedExoticItemHash: 3337759189,
        syntheticSets: [benchmarkTwoPieceSet],
        setRequirements: [{ setId: benchmarkTwoPieceSet.id, requiredPieces: 2 }],
        disableTuning: true,
        maxResults: 30_000
    }
];
