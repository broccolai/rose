import { describe, expect, test } from 'bun:test';

import { calculateManifestStats, createDefaultSelection, plugChoicesForSocket, reconcileSelection } from './catalog';
import type { WeaponCatalog, WeaponDefinition } from './types';

const rose: WeaponDefinition = {
    hash: 1,
    name: 'Rose',
    description: '',
    flavorText: '',
    icon: '/rose.jpg',
    watermark: '',
    screenshot: '',
    type: 'Hand Cannon',
    subtype: 9,
    element: 'kinetic',
    ammo: 'primary',
    slot: 'kinetic',
    rarity: 'legendary',
    source: 'Crucible',
    seasonHash: null,
    statGroupHash: 500,
    intrinsicHash: 100,
    intrinsicName: 'Lightweight Frame',
    adept: false,
    craftable: false,
    investmentStats: { '900': 50 },
    stats: [{ hash: 900, name: 'Range', value: 25, maximum: 100 }],
    sockets: [{ index: 1, label: 'Barrel', category: 'barrels', initialPlugHash: 10, plugSet: 0 }]
};

const catalog: WeaponCatalog = {
    schemaVersion: 1,
    manifestVersion: 'test',
    generatedAt: '2026-07-14T00:00:00Z',
    weapons: [rose],
    plugs: {
        '10': { hash: 10, name: 'Base', description: '', icon: '', category: '', label: '', enhanced: false, stats: {} },
        '11': { hash: 11, name: 'Range', description: '', icon: '', category: '', label: '', enhanced: false, stats: { '900': 10 } }
    },
    plugSets: [[10, 11]],
    statGroups: {
        '500': {
            maximumValue: 100,
            scaledStats: {
                '900': {
                    maximumValue: 100,
                    displayInterpolation: [
                        [0, 0],
                        [100, 50],
                        [200, 100]
                    ]
                }
            }
        }
    }
};

describe('weapon catalog model', () => {
    test('retains Stopping Power from the manifest catalog under its Oracle hash', async () => {
        const liveCatalog = (await Bun.file(new URL('../../../public/data/weapon-catalog.json', import.meta.url)).json()) as WeaponCatalog;
        const stoppingPowerHash = 1_517_798_362;
        const stoppingPower = liveCatalog.plugs[String(stoppingPowerHash)];

        expect(stoppingPower?.name).toBe('Stopping Power');
        expect(stoppingPower?.description).toContain('low-health targets');
        expect(
            liveCatalog.weapons.some((weapon) =>
                weapon.sockets.some((socket) => liveCatalog.plugSets[socket.plugSet]?.includes(stoppingPowerHash))
            )
        ).toBe(true);
    });

    test('reconciles stale shared plugs against the live manifest', () => {
        const defaults = createDefaultSelection(catalog, rose);
        expect(defaults.plugs).toEqual({ '1': 10 });
        expect(
            reconcileSelection(catalog, rose, {
                weaponHash: rose.hash,
                plugs: { '1': 999 },
                effects: { '999': 5 }
            })
        ).toEqual(defaults);
    });

    test('retains bounded intrinsic effects from shared links', () => {
        expect(
            reconcileSelection(catalog, rose, {
                weaponHash: rose.hash,
                plugs: { '1': 10 },
                effects: { '100': 3, '999': 5 }
            }).effects
        ).toEqual({ '100': 3 });
    });

    test('combines normal and enhanced plugs into one enhanced-first choice', () => {
        const enhancedCatalog: WeaponCatalog = {
            ...catalog,
            plugs: {
                ...catalog.plugs,
                '12': {
                    hash: 12,
                    name: 'Base',
                    description: 'Improved base perk.',
                    icon: '',
                    category: 'frames',
                    label: 'Enhanced Trait',
                    enhanced: false,
                    stats: { '900': 5 }
                }
            },
            plugSets: [[10, 11, 12]]
        };
        const socket = rose.sockets[0];
        expect(socket).toBeDefined();
        if (!socket) return;

        expect(plugChoicesForSocket(enhancedCatalog, socket)).toEqual([
            { hash: 12, hashes: [10, 12], enhanced: true },
            { hash: 11, hashes: [11], enhanced: false }
        ]);
        expect(createDefaultSelection(enhancedCatalog, rose).plugs).toEqual({ '1': 12 });
        expect(
            reconcileSelection(enhancedCatalog, rose, {
                weaponHash: rose.hash,
                plugs: { '1': 10 },
                effects: { '10': 2 }
            })
        ).toEqual({ weaponHash: rose.hash, plugs: { '1': 12 }, effects: { '12': 2 } });
    });

    test('interpolates investment stat changes into Bungie display values', () => {
        expect(calculateManifestStats(catalog, rose, { weaponHash: 1, plugs: { '1': 11 }, effects: {} })[0]?.value).toBe(30);
    });

    test('interpolates reversed display curves such as draw time', () => {
        const bow = {
            ...rose,
            type: 'Combat Bow',
            investmentStats: { '900': 60 },
            stats: [{ hash: 900, name: 'Draw Time', value: 667, maximum: 100 }]
        };
        const bowCatalog = {
            ...catalog,
            weapons: [bow],
            statGroups: {
                '500': {
                    maximumValue: 100,
                    scaledStats: {
                        '900': {
                            maximumValue: 100,
                            displayInterpolation: [
                                [0, 867],
                                [100, 533]
                            ]
                        }
                    }
                }
            }
        };

        expect(calculateManifestStats(bowCatalog, bow, { weaponHash: 1, plugs: { '1': 11 }, effects: {} })[0]?.value).toBe(633);
    });
});
