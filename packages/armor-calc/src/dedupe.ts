import { ARMOR_STATS, type ArmorItem, type StatAdjustment } from './types';

export function dedupeEquivalentArmorItems(items: ArmorItem[]) {
    const byKey = new Map<string, ArmorItem>();

    for (const item of items) {
        const key = equivalentArmorKey(item);
        const existing = byKey.get(key);

        if (!existing) {
            byKey.set(key, {
                ...item,
                equivalentItemInstanceIds: item.equivalentItemInstanceIds ?? [item.itemInstanceId]
            });
            continue;
        }

        existing.equivalentItemInstanceIds = [
            ...(existing.equivalentItemInstanceIds ?? [existing.itemInstanceId]),
            ...(item.equivalentItemInstanceIds ?? [item.itemInstanceId])
        ];
    }

    return [...byKey.values()];
}

function equivalentArmorKey(item: ArmorItem) {
    return [
        item.slot,
        item.classType,
        item.isExotic ? `exotic:${item.itemHash}` : 'legendary',
        item.set?.id ?? 'no-set',
        item.tier ?? 'no-tier',
        ...ARMOR_STATS.map((stat) => item.baseStats[stat]),
        ...item.statModOptions.map(adjustmentKey),
        ...item.tuningOptions.map(adjustmentKey)
    ].join('|');
}

function adjustmentKey(adjustment: StatAdjustment) {
    return [adjustment.id, ...ARMOR_STATS.map((stat) => adjustment.deltas[stat] ?? 0)].join(':');
}
