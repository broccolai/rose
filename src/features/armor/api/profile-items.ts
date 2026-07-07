import { ARMOR_SLOTS, type ArmorBuild, type ArmorItem, type ArmorSlot } from '@armor-calc';
import type { DestinyItemComponent } from 'bungie-api-ts/destiny2';
import type { UserMembershipData } from 'bungie-api-ts/user';

import type { VaultExportSnapshot } from '@/features/armor/types';

const BUNGIE_ORIGIN = 'https://www.bungie.net';

export interface SelectedCharacterItemLocation {
    location: 'selected-character';
    rank: number;
    item: DestinyItemComponent;
}

export interface VaultItemLocation {
    location: 'vault';
    rank: number;
    item: DestinyItemComponent;
}

export interface OtherCharacterItemLocation {
    location: 'other-character';
    rank: number;
    characterId: string;
    item: DestinyItemComponent;
}

export interface OtherCharacterEquippedItemLocation {
    location: 'other-character-equipped';
    rank: number;
    characterId: string;
    item: DestinyItemComponent;
}

export type EquipItemLocation =
    | SelectedCharacterItemLocation
    | VaultItemLocation
    | OtherCharacterItemLocation
    | OtherCharacterEquippedItemLocation;

export interface ResolvedBuildItem {
    itemInstanceId: string;
    location: EquipItemLocation;
}

export const readBungieUser = (snapshot: VaultExportSnapshot | null): UserMembershipData['bungieNetUser'] | undefined =>
    snapshot?.membershipsResponse?.Response?.bungieNetUser;

export const readSnapshotMembershipType = (snapshot: VaultExportSnapshot | null): number | null => {
    const membershipType = snapshot?.selectedMembership?.membershipType;
    return typeof membershipType === 'number' ? membershipType : null;
};

export const findProfileItemLocation = (
    snapshot: VaultExportSnapshot,
    itemInstanceId: string,
    selectedCharacterId: string
): EquipItemLocation | null => {
    const profile = snapshot.profileResponse?.Response;
    const profileInventoryItem = profile?.profileInventory?.data?.items?.find((item) => item.itemInstanceId === itemInstanceId);
    if (profileInventoryItem) {
        return {
            location: 'vault',
            rank: 1,
            item: profileInventoryItem
        };
    }

    const selectedInventoryItem = profile?.characterInventories?.data?.[selectedCharacterId]?.items?.find(
        (item) => item.itemInstanceId === itemInstanceId
    );
    const selectedEquippedItem = profile?.characterEquipment?.data?.[selectedCharacterId]?.items?.find(
        (item) => item.itemInstanceId === itemInstanceId
    );
    const selectedCharacterItem = selectedInventoryItem ?? selectedEquippedItem;
    if (selectedCharacterItem) {
        return {
            location: 'selected-character',
            rank: 0,
            item: selectedCharacterItem
        };
    }

    for (const [characterId, bucket] of Object.entries(profile?.characterInventories?.data ?? {})) {
        const item = bucket.items?.find((candidate) => candidate.itemInstanceId === itemInstanceId);
        if (item) {
            return {
                location: 'other-character',
                rank: 2,
                characterId,
                item
            };
        }
    }

    for (const [characterId, bucket] of Object.entries(profile?.characterEquipment?.data ?? {})) {
        const item = bucket.items?.find((candidate) => candidate.itemInstanceId === itemInstanceId);
        if (item) {
            return {
                location: 'other-character-equipped',
                rank: 3,
                characterId,
                item
            };
        }
    }

    return null;
};

export const resolveMovableBuildItem = (
    snapshot: VaultExportSnapshot,
    item: ArmorItem,
    selectedCharacterId: string
): ResolvedBuildItem | null => {
    const candidateIds = [...new Set([item.itemInstanceId, ...(item.equivalentItemInstanceIds ?? [])])];
    const candidates = candidateIds
        .map((itemInstanceId) => {
            const location = findProfileItemLocation(snapshot, itemInstanceId, selectedCharacterId);
            return location ? { itemInstanceId, location } : null;
        })
        .filter((candidate): candidate is ResolvedBuildItem => Boolean(candidate))
        .sort((left, right) => left.location.rank - right.location.rank);

    return candidates[0] ?? null;
};

export const createBuildWithResolvedItemIds = (build: ArmorBuild, resolvedItemIds: Record<ArmorSlot, string>): ArmorBuild => ({
    ...build,
    pieces: Object.fromEntries(
        ARMOR_SLOTS.map((slot) => [
            slot,
            {
                ...build.pieces[slot],
                item: {
                    ...build.pieces[slot].item,
                    itemInstanceId: resolvedItemIds[slot]
                }
            }
        ])
    ) as ArmorBuild['pieces']
});

export const absoluteBungieAssetUrl = (path?: string): string | undefined => {
    if (!path) {
        return undefined;
    }

    if (path.startsWith('http://') || path.startsWith('https://')) {
        return path;
    }

    return `${BUNGIE_ORIGIN}${path}`;
};
