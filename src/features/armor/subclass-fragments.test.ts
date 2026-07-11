import { describe, expect, test } from 'bun:test';

import {
    fragmentDescriptionsFromDefinitions,
    fragmentsForSubclass,
    getFragmentByHash,
    inferSubclassTypeFromName,
    resolveFragmentDescriptions
} from '@/features/armor/subclass-fragments';

describe('subclass fragment helpers', () => {
    test('infers subclass type from equipped subclass names', () => {
        expect(inferSubclassTypeFromName('Revenant')).toBe('Stasis');
        expect(inferSubclassTypeFromName('Gunslinger')).toBe('Solar');
        expect(inferSubclassTypeFromName('Prismatic Hunter')).toBe('Prismatic');
    });

    test('finds known fragments by Bungie plug hash', () => {
        expect(getFragmentByHash(2483898431)?.id).toBe('stasis:whisper-of-hunger');
        expect(getFragmentByHash(4180586737)?.id).toBe('solar:ember-of-mercy');
    });

    test('resolves official fragment descriptions from inventory definitions', async () => {
        const descriptions = await resolveFragmentDescriptions(async (hash) => ({
            displayProperties: {
                description: hash === 4180586737 ? 'Picking up a Firesprite grants restoration.' : ''
            }
        }));

        expect(descriptions['solar:ember-of-mercy']).toBe('Picking up a Firesprite grants restoration.');
        expect(descriptions['stasis:whisper-of-hunger']).toBeUndefined();
    });

    test('falls back to the manifest name when a legacy fragment hash is duplicated', async () => {
        const descriptions = await resolveFragmentDescriptions(
            async (hash) => ({
                displayProperties: {
                    name: hash === 2272984668 ? 'Echo of Undermining' : '',
                    description: hash === 2272984668 ? 'Grenades weaken targets.' : ''
                }
            }),
            (name) =>
                name === 'Echo of Exchange'
                    ? {
                          definition: {
                              displayProperties: {
                                  name,
                                  description: 'Melee final blows grant grenade energy.'
                              }
                          }
                      }
                    : null
        );

        expect(descriptions['void:echo-of-undermining']).toBe('Grenades weaken targets.');
        expect(descriptions['void:echo-of-exchange']).toBe('Melee final blows grant grenade energy.');
    });

    test('reads fragment descriptions from loaded benchmark definitions', () => {
        expect(
            fragmentDescriptionsFromDefinitions([
                {
                    hash: 2483898431,
                    definition: { displayProperties: { description: 'Increases melee energy gained from shards.' } }
                },
                {
                    hash: 123,
                    definition: { displayProperties: { description: 'Not a fragment.' } }
                }
            ])
        ).toEqual({
            'stasis:whisper-of-hunger': 'Increases melee energy gained from shards.'
        });
    });

    test('sorts subclass fragments by affected stat order', () => {
        expect(fragmentsForSubclass('Stasis').map((fragment) => fragment.id)).toEqual([
            'stasis:whisper-of-conduction',
            'stasis:whisper-of-impetus',
            'stasis:whisper-of-durance',
            'stasis:whisper-of-hunger',
            'stasis:whisper-of-fractures',
            'stasis:whisper-of-torment',
            'stasis:whisper-of-bonds',
            'stasis:whisper-of-chains'
        ]);
    });

    test('sorts positive fragment bonuses before negative bonuses for the same stat', () => {
        expect(fragmentsForSubclass('Prismatic').map((fragment) => fragment.id)).toEqual([
            'prismatic:facet-of-awakening',
            'prismatic:facet-of-grace',
            'prismatic:facet-of-devotion',
            'prismatic:facet-of-honor',
            'prismatic:facet-of-protection',
            'prismatic:facet-of-dawn',
            'prismatic:facet-of-courage',
            'prismatic:facet-of-sacrifice',
            'prismatic:facet-of-dominance',
            'prismatic:facet-of-justice',
            'prismatic:facet-of-defiance',
            'prismatic:facet-of-purpose',
            'prismatic:facet-of-ruin'
        ]);
    });
});
