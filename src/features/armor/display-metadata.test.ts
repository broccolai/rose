import { describe, expect, test } from 'bun:test';

import { ARMOR_SLOTS, ARMOR_STATS } from '@rose/armor-domain';

import { COMPACT_STAT_LABELS, SLOT_LABELS, STAT_LABELS } from '@/features/armor/display-metadata';

describe('armor display metadata', () => {
    test('covers every armor stat and slot', () => {
        expect(Object.keys(STAT_LABELS).sort()).toEqual([...ARMOR_STATS].sort());
        expect(Object.keys(COMPACT_STAT_LABELS).sort()).toEqual([...ARMOR_STATS].sort());
        expect(Object.keys(SLOT_LABELS).sort()).toEqual([...ARMOR_SLOTS].sort());
    });
});
