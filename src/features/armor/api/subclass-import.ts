import type { DestinyInventoryItemDefinition } from 'bungie-api-ts/destiny2';

import { getFragmentByHash, inferSubclassTypeFromName, type SubclassType } from '@/features/armor/subclass-fragments';
import type { LoadedManifestDefinition, VaultExportSnapshot } from '@/features/armor/types';

const SUBCLASS_BUCKET_HASH = 3284755031;

export interface EquippedSubclassImport {
    subclass: SubclassType;
    fragmentIds: string[];
    missingFragmentPlugHashes: number[];
    subclassItemName: string;
    subclassItemHash: number;
    subclassItemInstanceId: string;
}

export const readEquippedSubclassImport = async (
    snapshot: VaultExportSnapshot,
    characterId: string,
    definitions: LoadedManifestDefinition[],
    loadDefinition: (hash: number) => Promise<DestinyInventoryItemDefinition | null>
): Promise<EquippedSubclassImport | null> => {
    const profile = snapshot.profileResponse?.Response;
    const equippedItems = profile?.characterEquipment?.data?.[characterId]?.items ?? [];
    const definitionsByHash = new Map(definitions.map(({ hash, definition }) => [hash, definition]));
    const subclassItem =
        equippedItems.find((item) => item.bucketHash === SUBCLASS_BUCKET_HASH) ??
        equippedItems.find((item) => definitionsByHash.get(item.itemHash)?.inventory?.bucketTypeHash === SUBCLASS_BUCKET_HASH);

    if (!subclassItem?.itemInstanceId) {
        return null;
    }

    const subclassDefinition = definitionsByHash.get(subclassItem.itemHash) ?? (await loadDefinition(subclassItem.itemHash));
    const subclass = inferSubclassTypeFromName(subclassDefinition?.displayProperties?.name);
    if (!subclass) {
        return null;
    }

    const sockets = profile?.itemComponents?.sockets?.data?.[subclassItem.itemInstanceId]?.sockets ?? [];
    const fragmentIds: string[] = [];
    const missingFragmentPlugHashes: number[] = [];
    const seen = new Set<string>();

    for (const socket of sockets) {
        const plugHash = socket.plugHash;
        if (!plugHash) {
            continue;
        }

        const fragment = getFragmentByHash(plugHash);
        if (!fragment) {
            continue;
        }

        if (fragment.subclass !== subclass) {
            missingFragmentPlugHashes.push(plugHash);
            continue;
        }

        if (!seen.has(fragment.id)) {
            seen.add(fragment.id);
            fragmentIds.push(fragment.id);
        }
    }

    return {
        subclass,
        fragmentIds,
        missingFragmentPlugHashes,
        subclassItemName: subclassDefinition?.displayProperties?.name ?? `Subclass ${subclassItem.itemHash}`,
        subclassItemHash: subclassItem.itemHash,
        subclassItemInstanceId: subclassItem.itemInstanceId
    };
};
