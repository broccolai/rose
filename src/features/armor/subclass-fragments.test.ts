import { describe, expect, test } from 'bun:test';

import { getFragmentByHash, inferSubclassTypeFromName } from '@/features/armor/subclass-fragments';

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
});
