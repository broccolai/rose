import { describe, expect, test } from 'bun:test';

import { fragmentsForSubclass, getFragmentByHash, inferSubclassTypeFromName } from '@/features/armor/subclass-fragments';

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
