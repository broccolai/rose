import { describe, expect, test } from 'bun:test';

import { parseDebugExport } from '@/features/armor/model/debug-export-import';

describe('debug export import', () => {
    test('loads normalized data and sanitizes captured calculator choices', () => {
        const imported = parseDebugExport(
            JSON.stringify({
                metadata: {
                    app: 'rose-debug-vault-export',
                    exportedAt: '2026-07-11T10:56:08.016Z'
                },
                calculator: {
                    selectedCharacterId: 'hunter-1',
                    selectedExoticItemHash: '2405271937',
                    selectedSubclass: 'Stasis',
                    selectedFragmentIds: ['stasis:whisper-of-impetus'],
                    dumpStat: 'health',
                    allowBalancedTuning: true,
                    targets: { health: 0, weapons: 180 },
                    setSelections: { 'equipable:123': '2' }
                },
                normalizedProfile: emptyNormalizedProfile(),
                loadedManifestDefinitions: [{ hash: 123, definition: { hash: 123 } }]
            })
        );

        expect(imported.exportedAt).toBe('2026-07-11T10:56:08.016Z');
        expect(imported.loadedManifestDefinitions).toHaveLength(1);
        expect(imported.calculatorPreferences).toMatchObject({
            selectedCharacterId: 'hunter-1',
            selectedExoticItemHash: '2405271937',
            selectedSubclass: 'Stasis',
            selectedFragmentIds: ['stasis:whisper-of-impetus'],
            dumpStat: 'health',
            allowBalancedTuning: true,
            targets: { health: 0, melee: 0, grenade: 0, super: 0, class: 0, weapons: 180 },
            setSelections: { 'equipable:123': '2' }
        });
    });

    test('rejects unrelated JSON files', () => {
        expect(() => parseDebugExport(JSON.stringify({ metadata: { app: 'something-else' } }))).toThrow(
            'The selected file is not a Rose debug vault export.'
        );
    });

    test('rejects debug exports without normalized armor data', () => {
        expect(() =>
            parseDebugExport(
                JSON.stringify({
                    metadata: { app: 'rose-debug-vault-export' }
                })
            )
        ).toThrow('The debug export does not contain normalized armor data.');
    });
});

const emptyNormalizedProfile = () => ({
    characters: [],
    armor: [],
    armorBySlot: {
        helmet: [],
        arms: [],
        chest: [],
        legs: [],
        classItem: []
    },
    armorSetCatalog: [],
    warnings: []
});
