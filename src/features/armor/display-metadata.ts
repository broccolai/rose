import type { ArmorSlot, ArmorStat } from '@armor-domain';

export const STAT_LABELS: Record<ArmorStat, string> = {
    health: 'Health',
    melee: 'Melee',
    grenade: 'Grenade',
    super: 'Super',
    class: 'Class',
    weapons: 'Weapons'
};

export const COMPACT_STAT_LABELS: Record<ArmorStat, string> = {
    health: 'HP',
    melee: 'Me',
    grenade: 'Gr',
    super: 'Su',
    class: 'Cl',
    weapons: 'Wp'
};

export const SLOT_LABELS: Record<ArmorSlot, string> = {
    helmet: 'Helmet',
    arms: 'Arms',
    chest: 'Chest',
    legs: 'Legs',
    classItem: 'Class Item'
};
