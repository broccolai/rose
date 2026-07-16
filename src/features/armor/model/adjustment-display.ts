import { ARMOR_STATS, type StatAdjustment } from '@rose/armor-domain';

import { STAT_LABELS } from '@/features/armor/display-metadata';

export const formatStatModName = (adjustment: StatAdjustment | undefined): string => {
    if (!hasAdjustment(adjustment)) {
        return '-';
    }

    const idParts = adjustment.id.split(':');
    const stat = idParts[1];
    const value = idParts[2];
    if (stat && value && stat in STAT_LABELS) {
        return `+${value} ${STAT_LABELS[stat as keyof typeof STAT_LABELS]}`;
    }

    return capitalizeStatNames(adjustment.name);
};

export const formatTuningName = (adjustment: StatAdjustment | undefined): string =>
    hasAdjustment(adjustment) ? capitalizeStatNames(adjustment.name) : '-';

const hasAdjustment = (adjustment: StatAdjustment | undefined): adjustment is StatAdjustment =>
    Boolean(adjustment && ARMOR_STATS.some((stat) => (adjustment.deltas[stat] ?? 0) !== 0));

const capitalizeStatNames = (value: string): string =>
    value.replace(/\b(health|melee|grenade|super|class|weapons)\b/g, (match) => STAT_LABELS[match as keyof typeof STAT_LABELS]);
