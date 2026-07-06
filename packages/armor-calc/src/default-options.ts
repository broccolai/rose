import { createAdjustment } from './stats';
import { ARMOR_STATS, type ArmorItem, type StatAdjustment } from './types';

export const NO_STAT_MOD: StatAdjustment = createAdjustment('stat-mod:none', 'No stat mod', {});
export const NO_TUNING: StatAdjustment = createAdjustment('tuning:none', 'No tuning', {});

export function createDefaultStatModOptions() {
    return [
        NO_STAT_MOD,
        ...ARMOR_STATS.flatMap((stat) => [
            createAdjustment(`stat-mod:${stat}:5`, `+5 ${stat}`, { [stat]: 5 }),
            createAdjustment(`stat-mod:${stat}:10`, `+10 ${stat}`, { [stat]: 10 })
        ])
    ];
}

export function createTierFiveTuningOptions(item: Pick<ArmorItem, 'baseStats' | 'tier'>) {
    if (item.tier !== 5) {
        return [NO_TUNING];
    }

    const pairTunings: StatAdjustment[] = [];

    for (const increased of ARMOR_STATS) {
        for (const decreased of ARMOR_STATS) {
            if (increased === decreased) {
                continue;
            }

            pairTunings.push(
                createAdjustment(`tuning:${increased}:plus5:${decreased}:minus5`, `+5 ${increased}, -5 ${decreased}`, {
                    [increased]: 5,
                    [decreased]: -5
                })
            );
        }
    }

    const lowestStats = [...ARMOR_STATS].sort((left, right) => item.baseStats[left] - item.baseStats[right]).slice(0, 3);
    const lowestThreeTuning = createAdjustment(
        `tuning:lowest-three:${lowestStats.join('-')}`,
        `+1 ${lowestStats.join(', ')}`,
        Object.fromEntries(lowestStats.map((stat) => [stat, 1]))
    );

    return [NO_TUNING, ...pairTunings, lowestThreeTuning];
}
