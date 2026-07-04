import type { ArmorStat, DestinyClass } from '@armor-calc';

export const ARMOR_STAT_HASHES: Record<ArmorStat, number> = {
    health: 392767087,
    melee: 4244567218,
    grenade: 1735777505,
    super: 144602215,
    class: 1943323491,
    weapons: 2996146975
};

export const STAT_BY_HASH = Object.fromEntries(Object.entries(ARMOR_STAT_HASHES).map(([stat, hash]) => [String(hash), stat])) as Record<
    string,
    ArmorStat
>;

export const CLASS_BY_BUNGIE_CLASS_TYPE: Record<number, DestinyClass> = {
    0: 'titan',
    1: 'hunter',
    2: 'warlock',
    3: 'any'
};

export const BUNGIE_CLASS_TYPE_BY_CLASS: Record<DestinyClass, number> = {
    titan: 0,
    hunter: 1,
    warlock: 2,
    any: 3
};

export const CLASS_LABELS: Record<DestinyClass, string> = {
    titan: 'Titan',
    hunter: 'Hunter',
    warlock: 'Warlock',
    any: 'Any'
};
