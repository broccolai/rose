import type { StatAdjustment, StatVector } from './types';

export const ZERO_STATS: StatVector = {
    health: 0,
    melee: 0,
    grenade: 0,
    super: 0,
    class: 0,
    weapons: 0
};

export const emptyStats = (): StatVector => ({ ...ZERO_STATS });

export const subtractStats = (left: StatVector, right: Partial<StatVector>): StatVector => ({
    health: left.health - (right.health ?? 0),
    melee: left.melee - (right.melee ?? 0),
    grenade: left.grenade - (right.grenade ?? 0),
    super: left.super - (right.super ?? 0),
    class: left.class - (right.class ?? 0),
    weapons: left.weapons - (right.weapons ?? 0)
});

export const createAdjustment = (id: string, name: string, deltas: Partial<StatVector>): StatAdjustment => ({
    id,
    name,
    deltas
});
