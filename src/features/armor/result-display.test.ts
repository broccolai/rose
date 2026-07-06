import { describe, expect, test } from 'bun:test';

import { ARMOR_SLOTS, type ArmorBuild } from '@armor-calc';

import {
    type ArmorBonusDefinitionSet,
    buildExpansionKey,
    DEFAULT_RESULT_SORT,
    formatArmorBonusSummary,
    formatDimArmorQuery,
    getArmorBonusDisplays
} from '@/features/armor/result-display';

describe('result display helpers', () => {
    test('defaults to total descending instead of visible waste sorting', () => {
        expect(DEFAULT_RESULT_SORT).toEqual({ key: 'totalStats', direction: 'desc' });
    });

    test('formats active armor bonuses compactly', () => {
        expect(formatArmorBonusSummary(build({ bonuses: [] }))).toBe('-');
        expect(
            formatArmorBonusSummary(
                build({
                    bonuses: [
                        { setId: 'set:1', name: 'Wormlore', pieces: 2, activeBonuses: [2] },
                        { setId: 'set:2', name: 'Seraph', pieces: 4, activeBonuses: [2, 4] }
                    ]
                })
            )
        ).toBe('Wormlore 2pc / Seraph 4pc');
    });

    test('uses manifest perk names for active armor bonuses when available', () => {
        const armorSets: ArmorBonusDefinitionSet[] = [
            {
                id: 'set:seraph',
                bonuses: [
                    { requiredPieces: 2, name: 'Warmind Network', description: 'Two piece text.' },
                    { requiredPieces: 4, name: 'Rasputin Protocol', description: 'Four piece text.' }
                ],
                opBonuses: [{ requiredPieces: 4, source: 'Test', category: 'DPS', trigger: 'Trigger.', effect: 'Effect.' }]
            }
        ];
        const displays = getArmorBonusDisplays(
            build({
                bonuses: [{ setId: 'set:seraph', name: 'Seventh Seraph', pieces: 4, activeBonuses: [2, 4] }]
            }),
            armorSets
        );

        expect(displays.map((bonus) => bonus.label)).toEqual(['Warmind Network', 'Rasputin Protocol']);
        expect(displays.map((bonus) => bonus.isOp)).toEqual([false, true]);
        expect(
            formatArmorBonusSummary(
                build({ bonuses: [{ setId: 'set:seraph', name: 'Seventh Seraph', pieces: 4, activeBonuses: [4] }] }),
                armorSets
            )
        ).toBe('Rasputin Protocol');
    });

    test('keys expansion state by armor pieces and selected addons', () => {
        const first = build({ modId: 'mod:weapons' });
        const second = build({ modId: 'mod:super' });

        expect(buildExpansionKey(first)).not.toBe(buildExpansionKey(second));
    });

    test('formats a DIM armor query from build item instance ids', () => {
        expect(formatDimArmorQuery(build({}))).toBe('is:armor (id:helmet-1 or id:arms-1 or id:chest-1 or id:legs-1 or id:classItem-1)');
    });
});

function build(options: { bonuses?: ArmorBuild['activeSetBonuses']; modId?: string }): ArmorBuild {
    const pieces = Object.fromEntries(
        ARMOR_SLOTS.map((slot) => [
            slot,
            {
                item: {
                    itemInstanceId: `${slot}-1`,
                    itemHash: 1,
                    name: slot,
                    slot,
                    classType: 'warlock',
                    isExotic: false,
                    baseStats: {
                        health: 0,
                        melee: 0,
                        grenade: 0,
                        super: 0,
                        class: 0,
                        weapons: 0
                    },
                    statModOptions: [],
                    tuningOptions: []
                },
                statMod: options.modId ? { id: options.modId, name: options.modId, deltas: { weapons: 10 } } : undefined
            }
        ])
    ) as ArmorBuild['pieces'];

    return {
        pieces,
        stats: {
            health: 0,
            melee: 0,
            grenade: 0,
            super: 0,
            class: 0,
            weapons: 0
        },
        activeSetBonuses: options.bonuses ?? [],
        score: {
            wastedStats: 0,
            totalStats: 0
        }
    };
}
