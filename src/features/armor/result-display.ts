import { ARMOR_SLOTS, type ArmorBuild, type ArmorBuildSort } from '@armor-calc';

export { COMPACT_STAT_LABELS } from '@/features/armor/display-metadata';

export const DEFAULT_RESULT_SORT: ArmorBuildSort = { key: 'totalStats', direction: 'desc' };

export function formatArmorBonusSummary(build: ArmorBuild) {
    if (build.activeSetBonuses.length === 0) {
        return '-';
    }

    return build.activeSetBonuses.map((bonus) => `${bonus.name} ${bonus.activeBonuses.includes(4) ? '4pc' : '2pc'}`).join(' / ');
}

export function buildExpansionKey(build: ArmorBuild) {
    return ARMOR_SLOTS.map((slot) => {
        const piece = build.pieces[slot];
        return [piece.item.itemInstanceId, piece.statMod?.id ?? 'mod:none', piece.tuning?.id ?? 'tuning:none'].join(':');
    }).join('|');
}
