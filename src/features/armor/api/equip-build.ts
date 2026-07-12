import { ARMOR_SLOTS, type ArmorBuild, type ArmorSlot } from '@armor-domain';

import { createBungieManifestResolver } from '@/features/armor/manifest';
import type { LoadedManifestDefinition, VaultExportSnapshot } from '@/features/armor/types';
import { equipDestinyItems, transferDestinyItem } from '@/features/bungie/api';
import type { BungieToken } from '@/features/bungie/oauth';

import { createBuildWithResolvedItemIds, resolveMovableBuildItem } from './profile-items';
import {
    collectItemSocketPlugHashes,
    collectSocketPlugCategoryDefinitions,
    createDefinitionMap,
    type EquipProgressUpdate,
    insertBuildSocketPlugs
} from './socket-plugs';

export interface ApplyArmorBuildInput {
    token: BungieToken;
    snapshot: VaultExportSnapshot;
    membershipType: number;
    characterId: string;
    build: ArmorBuild;
    loadedManifestDefinitions: LoadedManifestDefinition[];
    onProgress?: (update: EquipProgressUpdate) => void;
    onEquippingAll?: () => void;
}

export interface ApplyArmorBuildResult {
    itemIds: string[];
    resolvedBuild: ArmorBuild;
}

export const applyArmorBuild = async ({
    token,
    snapshot,
    membershipType,
    characterId,
    build,
    loadedManifestDefinitions,
    onProgress,
    onEquippingAll
}: ApplyArmorBuildInput): Promise<ApplyArmorBuildResult> => {
    const resolvedItems = Object.fromEntries(
        ARMOR_SLOTS.map((slot) => {
            const piece = build.pieces[slot].item;
            const resolved = resolveMovableBuildItem(snapshot, piece, characterId);
            if (!resolved) {
                throw new Error(`Could not find ${piece.name} in the loaded Bungie profile.`);
            }

            return [slot, resolved];
        })
    ) as Record<ArmorSlot, NonNullable<ReturnType<typeof resolveMovableBuildItem>>>;
    const resolvedItemIds = Object.fromEntries(ARMOR_SLOTS.map((slot) => [slot, resolvedItems[slot].itemInstanceId])) as Record<
        ArmorSlot,
        string
    >;
    const resolvedBuild = createBuildWithResolvedItemIds(build, resolvedItemIds);
    const itemIds = ARMOR_SLOTS.map((slot) => resolvedItemIds[slot]);

    console.debug('[rose bungie api] Equip build started', {
        characterId,
        membershipType,
        itemIds,
        resolvedItems: Object.fromEntries(
            ARMOR_SLOTS.map((slot) => [
                slot,
                {
                    requestedItemInstanceId: build.pieces[slot].item.itemInstanceId,
                    resolvedItemInstanceId: resolvedItems[slot].itemInstanceId,
                    location: resolvedItems[slot].location.location,
                    sourceCharacterId:
                        resolvedItems[slot].location.location === 'other-character' ||
                        resolvedItems[slot].location.location === 'other-character-equipped'
                            ? resolvedItems[slot].location.characterId
                            : undefined
                }
            ])
        )
    });

    for (const slot of ARMOR_SLOTS) {
        const piece = resolvedBuild.pieces[slot].item;
        const location = resolvedItems[slot].location;

        if (location.location === 'selected-character') {
            continue;
        }

        if (location.location === 'other-character-equipped') {
            onProgress?.({
                slot,
                status: 'failed',
                detail: `${piece.name} is equipped on another character`
            });
            throw new Error(`${piece.name} is equipped on another character. Move or unequip it first, then refresh rose and try again.`);
        }

        if (location.location === 'other-character') {
            onProgress?.({
                slot,
                status: 'active',
                detail: `Moving ${piece.name} from another character to vault`
            });
            console.debug('[rose bungie api] Moving item from other character to vault', {
                itemName: piece.name,
                itemId: piece.itemInstanceId,
                sourceCharacterId: location.characterId
            });
            await transferDestinyItem(token, {
                itemReferenceHash: piece.itemHash,
                stackSize: 1,
                transferToVault: true,
                itemId: piece.itemInstanceId,
                characterId: location.characterId,
                membershipType
            });
        }

        onProgress?.({
            slot,
            status: 'active',
            detail: `Moving ${piece.name} onto selected character`
        });
        console.debug('[rose bungie api] Moving item from vault to selected character', {
            itemName: piece.name,
            itemId: piece.itemInstanceId,
            characterId
        });
        await transferDestinyItem(token, {
            itemReferenceHash: piece.itemHash,
            stackSize: 1,
            transferToVault: false,
            itemId: piece.itemInstanceId,
            characterId,
            membershipType
        });
    }

    const manifest = await createBungieManifestResolver();
    const itemSocketDefinitions = (
        await Promise.all(
            collectItemSocketPlugHashes(snapshot, itemIds).map(async (hash) => {
                const definition = await manifest.getInventoryItem(hash);
                return definition ? { hash, definition } : null;
            })
        )
    ).filter((definition): definition is LoadedManifestDefinition => Boolean(definition));
    const socketDefinitions = collectSocketPlugCategoryDefinitions(
        [...loadedManifestDefinitions, ...itemSocketDefinitions],
        manifest.getInventoryItemDefinitionsByPlugCategory
    );
    const dedupedSocketDefinitions = [...createDefinitionMap(socketDefinitions)].map(([hash, definition]) => ({
        hash,
        definition
    }));

    await insertBuildSocketPlugs(token, snapshot, membershipType, characterId, resolvedBuild, dedupedSocketDefinitions, onProgress);

    onEquippingAll?.();
    await equipDestinyItems(token, {
        itemIds,
        characterId,
        membershipType
    });

    console.debug('[rose bungie api] Equip build completed', {
        characterId,
        itemIds
    });

    return {
        itemIds,
        resolvedBuild
    };
};
