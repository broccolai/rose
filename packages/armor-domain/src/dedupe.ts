import { ARMOR_STATS, type ArmorItem, type StatAdjustment } from './types';

export const dedupeEquivalentArmorItems = (items: ArmorItem[]): ArmorItem[] => {
    const byKey = new Map<string, ArmorItem>();

    for (const item of items) {
        const key = equivalentArmorKey(item);
        const existing = byKey.get(key);

        if (!existing) {
            byKey.set(key, {
                ...item,
                equivalentItemInstanceIds: item.equivalentItemInstanceIds ?? [item.itemInstanceId],
                fullyMasterworkedItemInstanceIds: masterworkedItemInstanceIds(item)
            });
            continue;
        }

        existing.equivalentItemInstanceIds = [
            ...(existing.equivalentItemInstanceIds ?? [existing.itemInstanceId]),
            ...(item.equivalentItemInstanceIds ?? [item.itemInstanceId])
        ];
        existing.fullyMasterworkedItemInstanceIds = [
            ...(existing.fullyMasterworkedItemInstanceIds ?? []),
            ...masterworkedItemInstanceIds(item)
        ];
        existing.isCurrentMasterworked = (existing.fullyMasterworkedItemInstanceIds?.length ?? 0) > 0;
    }

    return [...byKey.values()];
};

const masterworkedItemInstanceIds = (item: ArmorItem): string[] => {
    if (item.fullyMasterworkedItemInstanceIds) {
        return item.fullyMasterworkedItemInstanceIds;
    }

    return item.isCurrentMasterworked ? [item.itemInstanceId] : [];
};

const equivalentArmorKey = (item: ArmorItem): string =>
    [
        item.slot,
        item.classType,
        item.isExotic ? `exotic:${item.itemHash}` : 'legendary',
        item.exoticClassItemPerkKey ?? 'no-exotic-perks',
        item.set?.id ?? 'no-set',
        item.tier ?? 'no-tier',
        ...ARMOR_STATS.map((stat) => item.baseStats[stat]),
        ...item.statModOptions.map(adjustmentKey),
        ...item.tuningOptions.map(adjustmentKey)
    ].join('|');

const adjustmentKey = (adjustment: StatAdjustment): string =>
    [adjustment.id, ...ARMOR_STATS.map((stat) => adjustment.deltas[stat] ?? 0)].join(':');
