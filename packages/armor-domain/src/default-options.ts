import { createAdjustment } from './stats';
import { ARMOR_STATS, type ArmorItem, type StatAdjustment } from './types';

export const NO_STAT_MOD: StatAdjustment = createAdjustment('stat-mod:none', 'No stat mod', {});
export const NO_TUNING: StatAdjustment = createAdjustment('tuning:none', 'No tuning', {});

export const createDefaultStatModOptions = (): StatAdjustment[] => [
    NO_STAT_MOD,
    ...ARMOR_STATS.flatMap((stat) => [
        createAdjustment(`stat-mod:${stat}:5`, `+5 ${stat}`, { [stat]: 5 }),
        createAdjustment(`stat-mod:${stat}:10`, `+10 ${stat}`, { [stat]: 10 })
    ])
];

export const createTierFiveTuningOptions = (item: Pick<ArmorItem, 'baseStats' | 'tier'>): StatAdjustment[] => {
    if (item.tier !== 5) {
        return [NO_TUNING];
    }

    const pairTunings = ARMOR_STATS.flatMap((increased) =>
        ARMOR_STATS.filter((decreased) => increased !== decreased).map((decreased) =>
            createAdjustment(`tuning:${increased}:plus5:${decreased}:minus5`, `+5 ${increased}, -5 ${decreased}`, {
                [increased]: 5,
                [decreased]: -5
            })
        )
    );
    const lowestStats = [...ARMOR_STATS].sort((left, right) => item.baseStats[left] - item.baseStats[right]).slice(0, 3);
    const balancedTuning = createAdjustment(
        `tuning:lowest-three:${lowestStats.join('-')}`,
        `+1 ${lowestStats.join(', ')}`,
        Object.fromEntries(lowestStats.map((stat) => [stat, 1]))
    );

    return [NO_TUNING, ...pairTunings, balancedTuning];
};
