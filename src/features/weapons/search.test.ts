import { describe, expect, test } from 'bun:test';
import type { WeaponCatalog, WeaponDefinition, WeaponPlug } from '@rose/weapon-model';
import { EMPTY_WEAPON_FILTERS, filterWeapons, rankWeaponResults } from '@/features/weapons/search';

function createWeapon(overrides: Partial<WeaponDefinition>): WeaponDefinition {
    return {
        hash: 1,
        name: 'Rose',
        description: '',
        flavorText: '',
        icon: '',
        watermark: '',
        screenshot: '',
        type: 'Hand Cannon',
        subtype: 9,
        element: 'kinetic',
        ammo: 'primary',
        slot: 'kinetic',
        rarity: 'legendary',
        source: 'Source: Glory Matches in Crucible',
        seasonHash: 100,
        statGroupHash: null,
        intrinsicHash: null,
        intrinsicName: 'Lightweight Frame',
        adept: false,
        craftable: false,
        stats: [{ hash: 4284893193, name: 'Rounds Per Minute', value: 140, maximum: 140 }],
        sockets: [
            { index: 3, label: 'Trait', category: 'frames', initialPlugHash: 10, plugSet: 0 },
            { index: 4, label: 'Trait', category: 'frames', initialPlugHash: 11, plugSet: 1 }
        ],
        ...overrides
    };
}

function createPlug(hash: number, name: string): WeaponPlug {
    return { hash, name, description: '', icon: '', category: '', label: '', enhanced: false, stats: {} };
}

const rose = createWeapon({});
const austringer = createWeapon({
    hash: 2,
    name: 'Austringer',
    element: 'solar',
    slot: 'energy',
    source: 'Source: The Derelict Leviathan',
    craftable: true,
    sockets: [
        { index: 3, label: 'Trait', category: 'frames', initialPlugHash: 11, plugSet: 1 },
        { index: 4, label: 'Trait', category: 'frames', initialPlugHash: 12, plugSet: 2 }
    ]
});
const palindrome = createWeapon({
    hash: 3,
    name: 'The Palindrome (Adept)',
    element: 'void',
    slot: 'energy',
    source: 'Source: Grandmaster Nightfall',
    adept: true,
    sockets: []
});

const catalog: WeaponCatalog = {
    schemaVersion: 1,
    manifestVersion: 'test',
    generatedAt: '2026-07-15T00:00:00Z',
    weapons: [rose, austringer, palindrome],
    plugs: {
        '10': createPlug(10, 'Rapid Hit'),
        '11': createPlug(11, 'Opening Shot'),
        '12': createPlug(12, 'Eye of the Storm')
    },
    plugSets: [[10], [11], [12]],
    statGroups: {}
};

describe('weapon query search', () => {
    test('matches plain names and normalized qualified values', () => {
        expect(filterWeapons(catalog, { ...EMPTY_WEAPON_FILTERS, query: 'rose source:crucible' })).toEqual([rose]);
        expect(filterWeapons(catalog, { query: 'weapon:handcannon energy:solar' })).toEqual([austringer]);
        expect(filterWeapons(catalog, { query: 'rpm:140 hash:3' })).toEqual([palindrome]);
    });

    test('supports boolean is filters and direct boolean fields', () => {
        expect(filterWeapons(catalog, { query: 'is:craftable' })).toEqual([austringer]);
        expect(filterWeapons(catalog, { query: 'craftable:true' })).toEqual([austringer]);
        expect(filterWeapons(catalog, { query: 'is:adept source:grandmaster' })).toEqual([palindrome]);
        expect(filterWeapons(catalog, { query: 'is:!craftable' })).toEqual([rose, palindrome]);
    });

    test('searches perk pools and individual trait columns', () => {
        expect(filterWeapons(catalog, { query: 'perk:"opening shot"' })).toEqual([rose, austringer]);
        expect(filterWeapons(catalog, { query: 'trait_1:opening trait_2:storm' })).toEqual([austringer]);
        expect(filterWeapons(catalog, { query: 'perk:opening,storm' })).toEqual([austringer]);
    });

    test('supports OR and leading negation without treating unknown fields as names', () => {
        expect(filterWeapons(catalog, { query: 'source:crucible|leviathan' })).toEqual([rose, austringer]);
        expect(filterWeapons(catalog, { query: 'weapon:"hand cannon" -source:crucible' })).toEqual([austringer, palindrome]);
        expect(filterWeapons(catalog, { query: 'unknown:rose' })).toEqual([]);
        expect(filterWeapons(catalog, { query: 'source:' })).toEqual(catalog.weapons);
    });

    test('ranks exact names before prefixes and incidental substrings', () => {
        const compassRose = createWeapon({ hash: 4, name: 'Compass Rose' });
        const prospector = createWeapon({ hash: 5, name: 'Prospector' });

        expect(rankWeaponResults([compassRose, prospector, rose], 'rose')).toEqual([rose, compassRose, prospector]);
    });
});
