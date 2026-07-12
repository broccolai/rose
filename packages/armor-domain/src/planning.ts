import { createDefaultStatModOptions, createTierFiveTuningOptions } from './default-options';
import { ARMOR_STATS, type ArmorArchetype, type ArmorRollProfile, type ArmorStat, type StatVector } from './types';

export const ARMOR_ARCHETYPES: readonly ArmorArchetype[] = [
    { id: 'bulwark', name: 'Bulwark', primaryStat: 'health', secondaryStat: 'class' },
    { id: 'siegebreaker', name: 'Siegebreaker', primaryStat: 'health', secondaryStat: 'grenade' },
    { id: 'brawler', name: 'Brawler', primaryStat: 'melee', secondaryStat: 'health' },
    { id: 'skirmisher', name: 'Skirmisher', primaryStat: 'melee', secondaryStat: 'weapons' },
    { id: 'grenadier', name: 'Grenadier', primaryStat: 'grenade', secondaryStat: 'super' },
    { id: 'demolitionist', name: 'Demolitionist', primaryStat: 'grenade', secondaryStat: 'class' },
    { id: 'paragon', name: 'Paragon', primaryStat: 'super', secondaryStat: 'melee' },
    { id: 'colossus', name: 'Colossus', primaryStat: 'super', secondaryStat: 'health' },
    { id: 'specialist', name: 'Specialist', primaryStat: 'class', secondaryStat: 'weapons' },
    { id: 'reaver', name: 'Reaver', primaryStat: 'class', secondaryStat: 'melee' },
    { id: 'gunner', name: 'Gunner', primaryStat: 'weapons', secondaryStat: 'grenade' },
    { id: 'powerhouse', name: 'Powerhouse', primaryStat: 'weapons', secondaryStat: 'super' }
];

const createBaseStats = (primaryStat: ArmorStat, secondaryStat: ArmorStat, tertiaryStat: ArmorStat): StatVector => {
    const stats = Object.fromEntries(ARMOR_STATS.map((stat) => [stat, 5])) as StatVector;
    stats[primaryStat] = 30;
    stats[secondaryStat] = 25;
    stats[tertiaryStat] = 20;

    return stats;
};

export const ARMOR_ROLL_PROFILES: readonly ArmorRollProfile[] = ARMOR_ARCHETYPES.flatMap((archetype) =>
    ARMOR_STATS.filter((stat) => stat !== archetype.primaryStat && stat !== archetype.secondaryStat).map((tertiaryStat) => {
        const baseStats = createBaseStats(archetype.primaryStat, archetype.secondaryStat, tertiaryStat);

        return {
            id: `${archetype.id}:${tertiaryStat}`,
            archetype,
            tertiaryStat,
            baseStats,
            statModOptions: createDefaultStatModOptions(),
            tuningOptions: createTierFiveTuningOptions({ baseStats, tier: 5 })
        };
    })
);
