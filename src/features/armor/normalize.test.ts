import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';

import { ARMOR_STATS, solveArmor } from '@armor-calc';

import { getAvailableArmorSets, makeArmorBySlotForClass, normalizeVaultExport } from '@/features/armor/normalize';
import { ARMOR_STAT_HASHES } from '@/features/armor/stat-hashes';
import type { ManifestInventoryItemDefinition, ManifestResolver, VaultExportSnapshot } from '@/features/armor/types';

const privateBundlePath = 'data/private/rose-loaded-benchmark-bundle-2026-07-04T14-56-53-877Z.json';

describe('loaded benchmark bundle input', () => {
    test('normalizes current socket choices then applies assumed masterwork stats', async () => {
        const itemInstanceId = 'armor-1';
        const itemHash = 1001;
        const masterworkHash = 2001;
        const reusableMasterworkHash = 2004;
        const emptyTuningHash = 2002;
        const superMinusHealthHash = 2003;
        const healthStatHash = 3001;
        const grenadeStatHash = 3002;
        const superStatHash = 3003;

        const definitions = new Map<number, ManifestInventoryItemDefinition>([
            [
                itemHash,
                {
                    hash: itemHash,
                    itemType: 2,
                    classType: 1,
                    displayProperties: { name: 'Test Current Helmet', description: '' },
                    inventory: { bucketTypeHash: 3448274439, tierType: 5, tierTypeName: 'Legendary' }
                }
            ],
            [masterworkHash, plug(masterworkHash, 'Upgrade Armor', 'v460.plugs.armor.masterworks', allArmorStats(1))],
            [reusableMasterworkHash, plug(reusableMasterworkHash, 'Upgrade Armor', 'v460.plugs.armor.masterworks', allArmorStats(2))],
            [emptyTuningHash, plug(emptyTuningHash, 'Empty Tuning Mod Socket', 'core.gear_systems.armor_tiering.plugs.tuning.mods', [])],
            [
                superMinusHealthHash,
                plug(superMinusHealthHash, '+Super / -Health', 'core.gear_systems.armor_tiering.plugs.tuning.mods', [
                    { statTypeHash: ARMOR_STAT_HASHES.super, value: 5 },
                    { statTypeHash: ARMOR_STAT_HASHES.health, value: -5 }
                ])
            ],
            [healthStatHash, plug(healthStatHash, '', 'armor_stats', [{ statTypeHash: ARMOR_STAT_HASHES.health, value: 20 }])],
            [grenadeStatHash, plug(grenadeStatHash, '', 'armor_stats', [{ statTypeHash: ARMOR_STAT_HASHES.grenade, value: 30 }])],
            [superStatHash, plug(superStatHash, '', 'armor_stats', [{ statTypeHash: ARMOR_STAT_HASHES.super, value: 25 }])]
        ]);
        const manifest: ManifestResolver = {
            async getInventoryItem(hash) {
                return definitions.get(hash) ?? null;
            }
        };
        const snapshot: VaultExportSnapshot = {
            profileResponse: {
                Response: {
                    profileInventory: { data: { items: [{ itemHash, itemInstanceId }] } },
                    characters: { data: { character: { classType: 1 } } },
                    itemComponents: {
                        stats: {
                            data: {
                                [itemInstanceId]: {
                                    stats: {
                                        [ARMOR_STAT_HASHES.health]: { value: 21 },
                                        [ARMOR_STAT_HASHES.melee]: { value: 1 },
                                        [ARMOR_STAT_HASHES.grenade]: { value: 31 },
                                        [ARMOR_STAT_HASHES.super]: { value: 26 },
                                        [ARMOR_STAT_HASHES.class]: { value: 1 },
                                        [ARMOR_STAT_HASHES.weapons]: { value: 1 }
                                    }
                                }
                            }
                        },
                        sockets: {
                            data: {
                                [itemInstanceId]: {
                                    sockets: [
                                        { plugHash: masterworkHash },
                                        { plugHash: healthStatHash },
                                        { plugHash: grenadeStatHash },
                                        { plugHash: superStatHash },
                                        { plugHash: emptyTuningHash }
                                    ]
                                }
                            }
                        },
                        reusablePlugs: {
                            data: {
                                [itemInstanceId]: {
                                    plugs: {
                                        '0': [{ plugItemHash: reusableMasterworkHash, canInsert: true, enabled: true }],
                                        '4': [{ plugItemHash: superMinusHealthHash, canInsert: true, enabled: true }]
                                    }
                                }
                            }
                        }
                    }
                }
            }
        };

        const profile = await normalizeVaultExport(snapshot, manifest);
        const armor = profile.armor[0];

        expect(profile.armor).toHaveLength(1);
        expect(armor?.baseStats).toMatchObject({
            health: 25,
            melee: 5,
            grenade: 35,
            super: 30,
            class: 5,
            weapons: 5
        });
        expect(armor?.tuningOptions.some((option) => option.deltas.super === 5 && option.deltas.health === -5)).toBe(true);
    });

    test('excludes lower gear tiers even when they have modern sockets', async () => {
        const itemHash = 4001;
        const itemInstanceId = 'tier-3-armor';
        const armorStatsPlugHash = 4002;
        const tuningPlugHash = 4003;
        const definitions = new Map<number, ManifestInventoryItemDefinition>([
            [
                itemHash,
                {
                    hash: itemHash,
                    itemType: 2,
                    classType: 2,
                    displayProperties: { name: 'Tier 3 Test Helm', description: '' },
                    inventory: { bucketTypeHash: 3448274439, tierType: 5, tierTypeName: 'Legendary' }
                }
            ],
            [armorStatsPlugHash, plug(armorStatsPlugHash, '', 'armor_stats', [{ statTypeHash: ARMOR_STAT_HASHES.health, value: 23 }])],
            [tuningPlugHash, plug(tuningPlugHash, 'Empty Tuning Mod Socket', 'core.gear_systems.armor_tiering.plugs.tuning.mods', [])]
        ]);
        const snapshot: VaultExportSnapshot = {
            profileResponse: {
                Response: {
                    profileInventory: { data: { items: [{ itemHash, itemInstanceId }] } },
                    characters: { data: { character: { classType: 2 } } },
                    itemComponents: {
                        instances: { data: { [itemInstanceId]: { gearTier: 3 } } },
                        stats: {
                            data: {
                                [itemInstanceId]: {
                                    stats: {
                                        [ARMOR_STAT_HASHES.health]: { value: 23 },
                                        [ARMOR_STAT_HASHES.melee]: { value: 0 },
                                        [ARMOR_STAT_HASHES.grenade]: { value: 0 },
                                        [ARMOR_STAT_HASHES.super]: { value: 0 },
                                        [ARMOR_STAT_HASHES.class]: { value: 0 },
                                        [ARMOR_STAT_HASHES.weapons]: { value: 0 }
                                    }
                                }
                            }
                        },
                        sockets: {
                            data: {
                                [itemInstanceId]: {
                                    sockets: [{ plugHash: armorStatsPlugHash }, { plugHash: tuningPlugHash }]
                                }
                            }
                        }
                    }
                }
            }
        };
        const profile = await normalizeVaultExport(snapshot, {
            async getInventoryItem(hash) {
                return definitions.get(hash) ?? null;
            }
        });

        expect(profile.armor).toHaveLength(0);
    });

    test('groups two armor pieces by equipable item set hash', async () => {
        const profile = await normalizeVaultExport(...syntheticArmorSetFixture([9001, 9001]));
        const sets = getAvailableArmorSets(profile.armor, 'hunter');

        expect(sets).toEqual([
            {
                id: 'equipable:9001',
                name: 'Roseshard',
                count: 2,
                slotCounts: { helmet: 1, arms: 1, chest: 0, legs: 0, classItem: 0 }
            }
        ]);
        expect(profile.armor.every((item) => item.set?.equipableItemSetHash === 9001)).toBe(true);
    });

    test('counts four compatible pieces for a four-piece set requirement option', async () => {
        const profile = await normalizeVaultExport(...syntheticArmorSetFixture([9002, 9002, 9002, 9002]));
        const sets = getAvailableArmorSets(profile.armor, 'hunter');

        expect(sets).toEqual([
            {
                id: 'equipable:9002',
                name: 'Roseshard',
                count: 4,
                slotCounts: { helmet: 1, arms: 1, chest: 1, legs: 1, classItem: 0 }
            }
        ]);
    });

    test('omits armor pieces without equipable item set hash from selectable sets', async () => {
        const profile = await normalizeVaultExport(...syntheticArmorSetFixture([undefined, undefined, 9003]));
        const sets = getAvailableArmorSets(profile.armor, 'hunter');

        expect(sets).toEqual([
            {
                id: 'equipable:9003',
                name: 'Roseshard Chest',
                count: 1,
                slotCounts: { helmet: 0, arms: 0, chest: 1, legs: 0, classItem: 0 }
            }
        ]);
        expect(sets.filter((set) => set.count >= 2)).toEqual([]);
    });

    test('builds an all-set catalog from manifest equipable item sets even when pieces are unowned', async () => {
        const profile = await normalizeVaultExport(
            {
                profileResponse: {
                    Response: {
                        profileInventory: { data: { items: [] } },
                        characters: { data: { character: { classType: 1 } } }
                    }
                }
            },
            syntheticCatalogManifest()
        );

        expect(profile.armorSetCatalog).toEqual([
            {
                id: 'equipable:9100',
                name: 'Roseshard',
                equipableItemSetHash: 9100,
                itemHashes: [7100, 7101, 7102, 7103],
                classTypes: ['hunter'],
                slots: ['helmet', 'arms', 'chest', 'legs'],
                bonuses: [
                    {
                        requiredPieces: 2,
                        sandboxPerkHash: 8102,
                        name: 'Roseshard Edge',
                        description: 'Two-piece bonus.',
                        iconUrl: 'https://www.bungie.net/img/theme/destiny/icons/icon.png'
                    },
                    {
                        requiredPieces: 4,
                        sandboxPerkHash: 8104,
                        name: 'Roseshard Bloom',
                        description: 'Four-piece bonus.',
                        iconUrl: undefined
                    }
                ],
                iconUrl: undefined
            }
        ]);
    });

    test('can read the saved private loaded bundle shape when present', async () => {
        if (!existsSync(privateBundlePath)) {
            return;
        }

        const bundle = JSON.parse(readFileSync(privateBundlePath, 'utf8')) as {
            vaultSnapshot?: VaultExportSnapshot;
            normalizedProfile?: { armor?: unknown[]; characters?: unknown[] };
            manifest?: { inventoryItemDefinitions?: Record<string, unknown> };
        };

        expect(bundle.vaultSnapshot?.profileResponse?.Response?.itemComponents?.stats?.data).toBeDefined();
        expect(bundle.normalizedProfile?.characters?.length ?? 0).toBeGreaterThan(0);
        expect(bundle.normalizedProfile?.armor?.length ?? 0).toBeGreaterThan(0);
        expect(Object.keys(bundle.manifest?.inventoryItemDefinitions ?? {}).length).toBeGreaterThan(0);

        const definitions = new Map(
            Object.entries(bundle.manifest?.inventoryItemDefinitions ?? {}).map(([hash, definition]) => [
                Number(hash),
                definition as ManifestInventoryItemDefinition
            ])
        );
        const profile = await normalizeVaultExport(bundle.vaultSnapshot as VaultExportSnapshot, {
            async getInventoryItem(hash) {
                return definitions.get(hash) ?? null;
            }
        });

        expect(profile.armor.every((item) => ARMOR_STATS.every((stat) => item.baseStats[stat] % 5 === 0))).toBe(true);
    });

    test('finds the saved Warlock Nezarec melee and weapons build when present', async () => {
        if (!existsSync(privateBundlePath)) {
            return;
        }

        const bundle = JSON.parse(readFileSync(privateBundlePath, 'utf8')) as {
            vaultSnapshot?: VaultExportSnapshot;
            manifest?: { inventoryItemDefinitions?: Record<string, unknown> };
        };
        const definitions = new Map(
            Object.entries(bundle.manifest?.inventoryItemDefinitions ?? {}).map(([hash, definition]) => [
                Number(hash),
                definition as ManifestInventoryItemDefinition
            ])
        );
        const profile = await normalizeVaultExport(bundle.vaultSnapshot as VaultExportSnapshot, {
            async getInventoryItem(hash) {
                return definitions.get(hash) ?? null;
            }
        });
        const armor = makeArmorBySlotForClass(profile.armor, 'warlock');
        const input = {
            characterId: 'warlock',
            classType: 'warlock' as const,
            selectedExoticItemHash: 925466716,
            statTargets: { weapons: 185 },
            setRequirements: [],
            armor
        };

        const result = solveArmor({
            ...input,
            statTargets: { melee: 130, weapons: 185 },
            maxResults: 1,
            stopWhenResultLimitReached: true
        });

        expect(result.ok).toBe(true);
        expect(result.ok && result.builds[0]?.stats.melee).toBeGreaterThanOrEqual(130);
        expect(result.ok && result.builds[0]?.stats.weapons).toBeGreaterThanOrEqual(185);
    });
});

function syntheticArmorSetFixture(setHashes: Array<number | undefined>): [VaultExportSnapshot, ManifestResolver] {
    const armorStatsPlugHash = 8001;
    const buckets = [3448274439, 3551918588, 14239492, 20886954, 1585787867];
    const names = ['Roseshard Helmet', 'Roseshard Arms', 'Roseshard Chest', 'Roseshard Legs', 'Roseshard Bond'];
    const definitions = new Map<number, ManifestInventoryItemDefinition>([
        [armorStatsPlugHash, plug(armorStatsPlugHash, '', 'armor_stats', [{ statTypeHash: ARMOR_STAT_HASHES.health, value: 10 }])]
    ]);
    const items = setHashes.map((setHash, index) => {
        const itemHash = 7000 + index;
        const itemInstanceId = `set-armor-${index}`;

        definitions.set(itemHash, {
            hash: itemHash,
            itemType: 2,
            classType: 1,
            displayProperties: { name: names[index] ?? `Roseshard Item ${index}`, description: '' },
            inventory: { bucketTypeHash: buckets[index] ?? buckets[0], tierType: 5, tierTypeName: 'Legendary' },
            equippingBlock: setHash === undefined ? undefined : { equipableItemSetHash: setHash }
        });

        return { itemHash, itemInstanceId };
    });
    const snapshot: VaultExportSnapshot = {
        profileResponse: {
            Response: {
                profileInventory: { data: { items } },
                characters: { data: { character: { classType: 1 } } },
                itemComponents: {
                    stats: {
                        data: Object.fromEntries(
                            items.map((item) => [
                                item.itemInstanceId,
                                {
                                    stats: {
                                        [ARMOR_STAT_HASHES.health]: { value: 10 },
                                        [ARMOR_STAT_HASHES.melee]: { value: 10 },
                                        [ARMOR_STAT_HASHES.grenade]: { value: 10 },
                                        [ARMOR_STAT_HASHES.super]: { value: 10 },
                                        [ARMOR_STAT_HASHES.class]: { value: 10 },
                                        [ARMOR_STAT_HASHES.weapons]: { value: 10 }
                                    }
                                }
                            ])
                        )
                    },
                    sockets: {
                        data: Object.fromEntries(
                            items.map((item) => [item.itemInstanceId, { sockets: [{ plugHash: armorStatsPlugHash }] }])
                        )
                    }
                }
            }
        }
    };
    const manifest: ManifestResolver = {
        async getInventoryItem(hash) {
            return definitions.get(hash) ?? null;
        }
    };

    return [snapshot, manifest];
}

function syntheticCatalogManifest(): ManifestResolver {
    const buckets = [3448274439, 3551918588, 14239492, 20886954];
    const definitions = new Map<number, ManifestInventoryItemDefinition>();

    for (const [index, bucketTypeHash] of buckets.entries()) {
        const itemHash = 7100 + index;
        const names = ['Roseshard Helm', 'Roseshard Grips', 'Roseshard Vest', 'Roseshard Strides'];
        definitions.set(itemHash, {
            hash: itemHash,
            itemType: 2,
            classType: 1,
            displayProperties: { name: names[index] ?? `Roseshard Item ${index}`, description: '' },
            inventory: { bucketTypeHash, tierType: 5, tierTypeName: 'Legendary' }
        });
    }

    return {
        async getInventoryItem(hash) {
            return definitions.get(hash) ?? null;
        },
        getEquipableItemSetDefinitions() {
            return [
                {
                    hash: 9100,
                    definition: {
                        hash: 9100,
                        displayProperties: { name: '', description: '' },
                        setItems: [7100, 7101, 7102, 7103],
                        setPerks: [
                            { requiredSetCount: 2, sandboxPerkHash: 8102 },
                            { requiredSetCount: 4, sandboxPerkHash: 8104 }
                        ]
                    }
                }
            ];
        },
        async getSandboxPerk(hash) {
            if (hash === 8102) {
                return {
                    hash,
                    displayProperties: {
                        name: 'Roseshard Edge',
                        description: 'Two-piece bonus.',
                        icon: '/img/theme/destiny/icons/icon.png'
                    }
                };
            }

            if (hash === 8104) {
                return {
                    hash,
                    displayProperties: {
                        name: 'Roseshard Bloom',
                        description: 'Four-piece bonus.'
                    }
                };
            }

            return null;
        }
    };
}

function plug(
    hash: number,
    name: string,
    plugCategoryIdentifier: string,
    investmentStats: Array<{ statTypeHash: number; value: number }>
): ManifestInventoryItemDefinition {
    return {
        hash,
        displayProperties: { name, description: '' },
        plug: { plugCategoryIdentifier },
        investmentStats
    };
}

function allArmorStats(value: number) {
    return Object.values(ARMOR_STAT_HASHES).map((statTypeHash) => ({ statTypeHash, value }));
}
