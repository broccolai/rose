import { describe, expect, test } from 'bun:test';

import type { DestinyInventoryItemDefinition } from 'bungie-api-ts/destiny2';

import { normalizeVaultExport } from '@/features/armor/normalize';
import { ARMOR_STAT_HASHES } from '@/features/armor/stat-hashes';
import type { ManifestResolver, VaultExportSnapshot } from '@/features/armor/types';

const LEFT_PERK_SOCKET_TYPE = 4039767041;
const RIGHT_PERK_SOCKET_TYPE = 2771980068;

describe('exotic class item normalization', () => {
    test('preserves different perk pairs while deduping equivalent copies of the same pair', async () => {
        const itemHash = 100;
        const armorStatsPlugHash = 200;
        const calibanHash = 201;
        const liarHash = 202;
        const assassinHash = 203;
        const coyoteHash = 204;
        const items = [
            { itemHash, itemInstanceId: 'caliban-liar-a' },
            { itemHash, itemInstanceId: 'caliban-liar-b' },
            { itemHash, itemInstanceId: 'assassin-coyote' }
        ];
        const definitions = new Map<number, DestinyInventoryItemDefinition>([
            [itemHash, exoticClassItemDefinition(itemHash)],
            [armorStatsPlugHash, plugDefinition(armorStatsPlugHash, '', 'armor_stats')],
            [calibanHash, plugDefinition(calibanHash, 'Spirit of Caliban', 'exotic.class_item.left')],
            [liarHash, plugDefinition(liarHash, 'Spirit of the Liar', 'exotic.class_item.right')],
            [assassinHash, plugDefinition(assassinHash, 'Spirit of the Assassin', 'exotic.class_item.left')],
            [coyoteHash, plugDefinition(coyoteHash, 'Spirit of the Coyote', 'exotic.class_item.right')]
        ]);
        const snapshot: VaultExportSnapshot = {
            profileResponse: {
                Response: {
                    profileInventory: { data: { items } },
                    characters: { data: { warlock: { classType: 2 } } },
                    itemComponents: {
                        instances: {
                            data: Object.fromEntries(items.map((item) => [item.itemInstanceId, { gearTier: 5 }]))
                        },
                        stats: {
                            data: Object.fromEntries(
                                items.map((item) => [
                                    item.itemInstanceId,
                                    {
                                        stats: Object.fromEntries(
                                            Object.values(ARMOR_STAT_HASHES).map((statHash) => [statHash, { value: 15 }])
                                        )
                                    }
                                ])
                            )
                        },
                        sockets: {
                            data: {
                                'caliban-liar-a': {
                                    sockets: [{ plugHash: armorStatsPlugHash }, { plugHash: calibanHash }, { plugHash: liarHash }]
                                },
                                'caliban-liar-b': {
                                    sockets: [{ plugHash: armorStatsPlugHash }, { plugHash: calibanHash }, { plugHash: liarHash }]
                                },
                                'assassin-coyote': {
                                    sockets: [{ plugHash: armorStatsPlugHash }, { plugHash: assassinHash }, { plugHash: coyoteHash }]
                                }
                            }
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

        const profile = await normalizeVaultExport(snapshot, manifest);

        expect(profile.armor).toHaveLength(2);
        expect(
            profile.armor.map((item) => ({
                key: item.exoticClassItemPerkKey,
                perks: item.exoticClassItemPerks?.map((perk) => perk.name),
                copies: item.equivalentItemInstanceIds?.length
            }))
        ).toEqual([
            {
                key: `${calibanHash}:${liarHash}`,
                perks: ['Spirit of Caliban', 'Spirit of the Liar'],
                copies: 2
            },
            {
                key: `${assassinHash}:${coyoteHash}`,
                perks: ['Spirit of the Assassin', 'Spirit of the Coyote'],
                copies: 1
            }
        ]);
    });
});

const exoticClassItemDefinition = (hash: number): DestinyInventoryItemDefinition => ({
    hash,
    itemType: 2,
    classType: 2,
    displayProperties: { name: 'Solipsism', description: '' },
    inventory: { bucketTypeHash: 1585787867, tierType: 6, tierTypeName: 'Exotic' },
    sockets: {
        socketEntries: [{ socketTypeHash: 0 }, { socketTypeHash: LEFT_PERK_SOCKET_TYPE }, { socketTypeHash: RIGHT_PERK_SOCKET_TYPE }]
    } as DestinyInventoryItemDefinition['sockets']
});

const plugDefinition = (hash: number, name: string, plugCategoryIdentifier: string): DestinyInventoryItemDefinition => ({
    hash,
    displayProperties: { name, description: `${name} description` },
    plug: { plugCategoryIdentifier }
});
