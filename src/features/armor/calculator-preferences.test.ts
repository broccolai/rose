import { describe, expect, test } from 'bun:test';

import {
    CALCULATOR_PREFERENCES_KEY,
    clearCalculatorPreferences,
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
                armorSetDisplayMode: 'sources',
                dumpStat: 'health',
                allowBalancedTuning: 'yes',
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
            armorSetDisplayMode: 'sources',
            dumpStat: 'health',
            allowBalancedTuning: false,
            targets: {
                health: 0,
                melee: 42,
                grenade: 200,
                super: 0,
                class: 70,
                weapons: 100
            },
            setSelections: {
                keep2: '2',
                keep4: '4',
                keep0: '0'
            },
            resultSort: {
                key: 'weapons',
                direction: 'desc'
            }
        });
    });

    test('falls back to safe sort and dump stat values', () => {
        expect(
            sanitizeCalculatorPreferences({
                dumpStat: 'mobility',
                armorSetDisplayMode: 'invalid',
                resultSort: {
                    key: 'wastedStats',
                    direction: 'sideways'
                }
            })
        ).toMatchObject({
            armorSetDisplayMode: 'sets',
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
