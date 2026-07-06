import { ARMOR_SLOTS, type ArmorBuild, type ArmorBuildSort } from '@armor-calc';

export { COMPACT_STAT_LABELS } from '@/features/armor/display-metadata';

export const DEFAULT_RESULT_SORT: ArmorBuildSort = { key: 'totalStats', direction: 'desc' };

export type ArmorBonusDefinitionSet = {
    id: string;
    bonuses: Array<{
        requiredPieces: number;
        name: string;
        description?: string;
    }>;
    opBonuses?: Array<{
        requiredPieces: 2 | 4;
        source: string;
        category: string;
        trigger: string;
        effect: string;
        bugged?: boolean;
    }>;
};

export type ArmorBonusDisplay = {
    label: string;
    title: string;
    isOp: boolean;
};

export function getArmorBonusDisplays(build: ArmorBuild, armorSets: ArmorBonusDefinitionSet[] = []): ArmorBonusDisplay[] {
    if (build.activeSetBonuses.length === 0) {
        return [];
    }

    const setsById = new Map(armorSets.map((set) => [set.id, set]));

    return build.activeSetBonuses.flatMap((activeBonus) => {
        const set = setsById.get(activeBonus.setId);

        if (!set) {
            const pieces = activeBonus.activeBonuses.includes(4) ? 4 : 2;
            const label = `${activeBonus.name} ${pieces}pc`;
            return [{ label, title: label, isOp: false }];
        }

        return [...activeBonus.activeBonuses]
            .sort((left, right) => left - right)
            .map((pieces) => {
                const manifestBonus = set.bonuses.find((bonus) => bonus.requiredPieces === pieces);
                const opBonus = set.opBonuses?.find((bonus) => bonus.requiredPieces === pieces);
                const label = manifestBonus?.name || `${activeBonus.name} ${pieces}pc`;
                const title = [
                    manifestBonus?.name || `${pieces}pc ${activeBonus.name}`,
                    manifestBonus?.description,
                    opBonus
                        ? `OP ${opBonus.source} (${opBonus.category}${opBonus.bugged ? ', bugged' : ''})\nTrigger: ${opBonus.trigger}\nEffect: ${opBonus.effect}`
                        : ''
                ]
                    .filter(Boolean)
                    .join('\n');

                return {
                    label,
                    title,
                    isOp: Boolean(opBonus)
                };
            });
    });
}

export function formatArmorBonusSummary(build: ArmorBuild, armorSets: ArmorBonusDefinitionSet[] = []) {
    const displays = getArmorBonusDisplays(build, armorSets);

    if (displays.length === 0) {
        return '-';
    }

    return displays.map((bonus) => bonus.label).join(' / ');
}

export function formatDimArmorQuery(build: ArmorBuild) {
    const itemIds = ARMOR_SLOTS.map((slot) => build.pieces[slot].item.itemInstanceId).filter(Boolean);

    return `is:armor (${itemIds.map((itemId) => `id:${itemId}`).join(' or ')})`;
}

export function buildExpansionKey(build: ArmorBuild) {
    return ARMOR_SLOTS.map((slot) => {
        const piece = build.pieces[slot];
        return [piece.item.itemInstanceId, piece.statMod?.id ?? 'mod:none', piece.tuning?.id ?? 'tuning:none'].join(':');
    }).join('|');
}
