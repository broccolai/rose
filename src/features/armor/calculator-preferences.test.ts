import { describe, expect, test } from 'bun:test';

import {
    applySetSelectionLimit,
    CALCULATOR_PREFERENCES_KEY,
    clearCalculatorPreferences,
    limitSetSelections,
    mergeCalculatorPreferencesForStorage,
    readCalculatorPreferences,
    sanitizeCalculatorPreferences,
    writeCalculatorPreferences
} from '@/features/armor/calculator-preferences';

describe('calculator preferences', () => {
    test('sanitizes stored calculator choices', () => {
        expect(
            sanitizeCalculatorPreferences({
                selectedCharacterId: 'character-1',
                selectedExoticItemHash: '123',
                appTheme: 'dim',
                armorSetDisplayMode: 'sources',
                selectedSubclass: 'Solar',
                selectedFragmentIds: ['solar:ember-of-beams', 'void:echo-of-dilation', 'solar:ember-of-beams'],
                dumpStat: 'health',
                allowBalancedTuning: 'yes',
                onlyFullyMasterworkedGear: true,
                targets: {
                    health: -10,
                    melee: 42.9,
                    grenade: 250,
                    super: Number.POSITIVE_INFINITY,
                    class: '70',
                    weapons: 100
                },
                setSelections: {
                    keep2: '2',
                    keep4: '4',
                    keep0: '0',
                    drop: '3'
                },
                resultSort: {
                    key: 'weapons',
                    direction: 'desc'
                }
            })
        ).toEqual({
            selectedCharacterId: 'character-1',
            selectedExoticItemHash: '123',
            appTheme: 'dim',
            armorSetDisplayMode: 'sources',
            selectedSubclass: 'Solar',
            selectedFragmentIds: ['solar:ember-of-beams'],
            dumpStat: 'health',
            allowBalancedTuning: false,
            onlyFullyMasterworkedGear: true,
            targets: {
                health: 0,
                melee: 42,
                grenade: 200,
                super: 0,
                class: 70,
                weapons: 100
            },
            setSelections: {
                keep4: '4'
            },
            resultSort: {
                key: 'weapons',
                direction: 'desc'
            }
        });
    });

    test('limits set selections to either two 2-piece sets or one 4-piece set', () => {
        expect(
            applySetSelectionLimit(
                {
                    first: '2',
                    second: '2'
                },
                'third',
                '2'
            )
        ).toEqual({
            second: '2',
            third: '2'
        });

        expect(
            applySetSelectionLimit(
                {
                    first: '2',
                    second: '2'
                },
                'raid',
                '4'
            )
        ).toEqual({
            raid: '4'
        });

        expect(
            limitSetSelections({
                first: '2',
                second: '2',
                third: '2',
                raid: '4'
            })
        ).toEqual({
            raid: '4'
        });
    });

    test('falls back to safe sort and dump stat values', () => {
        expect(
            sanitizeCalculatorPreferences({
                dumpStat: 'mobility',
                armorSetDisplayMode: 'invalid',
                selectedSubclass: 'invalid',
                selectedFragmentIds: 'nope',
                resultSort: {
                    key: 'wastedStats',
                    direction: 'sideways'
                }
            })
        ).toMatchObject({
            appTheme: 'void',
            armorSetDisplayMode: 'sets',
            selectedSubclass: 'Prismatic',
            selectedFragmentIds: [],
            dumpStat: '',
            resultSort: {
                key: 'totalStats',
                direction: 'asc'
            }
        });
    });

    test('preserves selected character and exotic while profile data is absent', () => {
        expect(
            mergeCalculatorPreferencesForStorage(
                {
                    selectedCharacterId: 'warlock',
                    selectedExoticItemHash: '999'
                },
                {
                    dumpStat: 'health'
                },
                false
            )
        ).toMatchObject({
            selectedCharacterId: 'warlock',
            selectedExoticItemHash: '999',
            dumpStat: 'health'
        });
    });

    test('reads writes and clears storage through an injected storage object', () => {
        const storage = createMemoryStorage();

        writeCalculatorPreferences({ selectedCharacterId: 'hunter', dumpStat: 'weapons' }, storage);

        expect(storage.getItem(CALCULATOR_PREFERENCES_KEY)).toBeTruthy();
        expect(readCalculatorPreferences(storage)).toMatchObject({
            selectedCharacterId: 'hunter',
            dumpStat: 'weapons'
        });

        clearCalculatorPreferences(storage);

        expect(readCalculatorPreferences(storage)).toBeNull();
    });

    test('ignores invalid JSON from storage', () => {
        const storage = createMemoryStorage();
        storage.setItem(CALCULATOR_PREFERENCES_KEY, '{nope');

        expect(readCalculatorPreferences(storage)).toBeNull();
    });
});

function createMemoryStorage() {
    const values = new Map<string, string>();

    return {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key)
    };
}
