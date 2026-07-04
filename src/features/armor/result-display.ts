import { ARMOR_SLOTS, type ArmorBuild, type ArmorBuildSort, type ArmorStat } from '@armor-calc';

export const DEFAULT_RESULT_SORT: ArmorBuildSort = { key: 'totalStats', direction: 'desc' };

export const COMPACT_STAT_LABELS: Record<ArmorStat, string> = {
    health: 'HP',
    melee: 'Me',
    grenade: 'Gr',
    super: 'Su',
    class: 'Cl',
    weapons: 'Wp'
};

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
