import {
    ARMOR_SLOTS,
    ARMOR_STATS,
    type ArmorBuild,
    type ArmorItem,
    type ArmorSlot,
    type StatAdjustment,
    type StatVector
} from '@rose/armor-domain';
import type { DestinyInventoryItemDefinition } from 'bungie-api-ts/destiny2';

import { STAT_BY_HASH } from '@/features/armor/stat-hashes';
import type { LoadedManifestDefinition, VaultExportSnapshot } from '@/features/armor/types';
import { insertSocketPlugFree } from '@/features/bungie/api';
import type { BungieToken } from '@/features/bungie/oauth';

const GENERAL_ARMOR_MOD_PLUG_CATEGORY = 'enhancements.v2_general';
const CLEARABLE_ARMOR_MOD_PLUG_CATEGORY_PREFIX = 'enhancements.';
const TUNING_PLUG_CATEGORY = 'core.gear_systems.armor_tiering.plugs.tuning.mods';
const DEFAULT_SOCKET_ARRAY_TYPE = 0;

export interface EquipProgressUpdate {
    slot?: ArmorSlot;
    status?: 'pending' | 'active' | 'done' | 'failed';
    detail: string;
}

export const emptyStatVector = (): StatVector => ({
    health: 0,
    melee: 0,
    grenade: 0,
    super: 0,
    class: 0,
    weapons: 0
});

export const statTotal = (stats: StatVector): number => ARMOR_STATS.reduce((total, stat) => total + stats[stat], 0);

export const readInvestmentStats = (definition: DestinyInventoryItemDefinition): StatVector => {
    const normalized = emptyStatVector();

    for (const investmentStat of definition.investmentStats ?? []) {
        const stat = STAT_BY_HASH[String(investmentStat.statTypeHash)];
        if (stat) {
            normalized[stat] += investmentStat.value;
        }
    }

    return normalized;
};

export const sumStats = (vectors: StatVector[]): StatVector => {
    const total = emptyStatVector();

    for (const vector of vectors) {
        for (const stat of ARMOR_STATS) {
            total[stat] += vector[stat];
        }
    }

    return total;
};

export const createDefinitionMap = (definitions: LoadedManifestDefinition[]): Map<number, DestinyInventoryItemDefinition> =>
    new Map(definitions.map(({ hash, definition }) => [hash, definition]));

const statAdjustmentIsZero = (adjustment: StatAdjustment): boolean => ARMOR_STATS.every((stat) => (adjustment.deltas[stat] ?? 0) === 0);

const statVectorMatchesAdjustment = (stats: StatVector, adjustment: StatAdjustment): boolean =>
    ARMOR_STATS.every((stat) => stats[stat] === (adjustment.deltas[stat] ?? 0));

const definitionMatchesAdjustment = (
    definition: DestinyInventoryItemDefinition | undefined,
    plugCategory: string,
    adjustment: StatAdjustment
): boolean =>
    definition?.plug?.plugCategoryIdentifier === plugCategory && statVectorMatchesAdjustment(readInvestmentStats(definition), adjustment);

const parsePlugHashFromAdjustment = (adjustment: StatAdjustment): number | null => {
    const match = /^plug:(\d+)$/.exec(adjustment.id);
    return match ? Number(match[1]) : null;
};

const readItemSocketPlugHash = (snapshot: VaultExportSnapshot, itemInstanceId: string, socketIndex: number): number | undefined =>
    snapshot.profileResponse?.Response?.itemComponents?.sockets?.data?.[itemInstanceId]?.sockets?.[socketIndex]?.plugHash;

const readReusablePlugHashes = (
    snapshot: VaultExportSnapshot,
    itemInstanceId: string,
    socketIndex: number,
    options: { includeUnavailable?: boolean } = {}
): number[] => {
    const plugs = snapshot.profileResponse?.Response?.itemComponents?.reusablePlugs?.data?.[itemInstanceId]?.plugs ?? {};
    return (plugs[socketIndex] ?? [])
        .filter((plug) => options.includeUnavailable || (plug.canInsert !== false && plug.enabled !== false))
        .map((plug) => plug.plugItemHash)
        .filter((hash): hash is number => typeof hash === 'number');
};

const createInsertedSocketReport = (itemName: string, kind: string, socketIndex: number, plugItemHash: number, plugName?: string) => ({
    itemName,
    kind,
    socketIndex,
    plugItemHash,
    ...(plugName ? { plugName } : {})
});

export const collectItemSocketPlugHashes = (snapshot: VaultExportSnapshot, itemInstanceIds: string[]): number[] => {
    const hashes = new Set<number>();
    const profile = snapshot.profileResponse?.Response;

    for (const itemInstanceId of itemInstanceIds) {
        for (const socket of profile?.itemComponents?.sockets?.data?.[itemInstanceId]?.sockets ?? []) {
            if (socket.plugHash) {
                hashes.add(socket.plugHash);
            }
        }

        const reusablePlugs = profile?.itemComponents?.reusablePlugs?.data?.[itemInstanceId]?.plugs ?? {};
        for (const plugs of Object.values(reusablePlugs)) {
            for (const plug of plugs) {
                if (plug.plugItemHash) {
                    hashes.add(plug.plugItemHash);
                }
            }
        }
    }

    return [...hashes];
};

const isEmptySocketPlug = (definition: DestinyInventoryItemDefinition | undefined): boolean => {
    const name = definition?.displayProperties?.name?.toLowerCase() ?? '';
    return name.includes('empty') && definition ? statTotal(readInvestmentStats(definition)) === 0 : false;
};

const isClearableArmorModCategory = (plugCategory: string | undefined): boolean =>
    Boolean(plugCategory?.startsWith(CLEARABLE_ARMOR_MOD_PLUG_CATEGORY_PREFIX));

const findEmptyPlugHashForSocket = (
    snapshot: VaultExportSnapshot,
    itemInstanceId: string,
    socketIndex: number,
    definitionsByHash: Map<number, DestinyInventoryItemDefinition>
): number | null =>
    readReusablePlugHashes(snapshot, itemInstanceId, socketIndex, { includeUnavailable: true }).find((plugHash) =>
        isEmptySocketPlug(definitionsByHash.get(plugHash))
    ) ?? null;

const readClearableArmorModSockets = (
    snapshot: VaultExportSnapshot,
    itemInstanceId: string,
    definitionsByHash: Map<number, DestinyInventoryItemDefinition>
) => {
    const sockets = snapshot.profileResponse?.Response?.itemComponents?.sockets?.data?.[itemInstanceId]?.sockets ?? [];
    return sockets
        .map((socket, socketIndex) => {
            const currentDefinition = socket.plugHash ? definitionsByHash.get(socket.plugHash) : undefined;
            const currentCategory = currentDefinition?.plug?.plugCategoryIdentifier;
            const reusableCategories = readReusablePlugHashes(snapshot, itemInstanceId, socketIndex, { includeUnavailable: true })
                .map((plugHash) => definitionsByHash.get(plugHash)?.plug?.plugCategoryIdentifier)
                .filter((category): category is string => Boolean(category));
            const clearable =
                isClearableArmorModCategory(currentCategory) ||
                reusableCategories.some((category) => isClearableArmorModCategory(category));

            return clearable
                ? {
                      socketIndex,
                      currentPlugHash: socket.plugHash,
                      currentPlugName: currentDefinition?.displayProperties?.name,
                      currentCategory,
                      emptyPlugHash: findEmptyPlugHashForSocket(snapshot, itemInstanceId, socketIndex, definitionsByHash)
                  }
                : null;
        })
        .filter((socket): socket is NonNullable<typeof socket> => Boolean(socket));
};

const currentSocketMatchesAdjustment = (
    snapshot: VaultExportSnapshot,
    itemInstanceId: string,
    socketIndex: number,
    plugCategory: string,
    adjustment: StatAdjustment,
    definitionsByHash: Map<number, DestinyInventoryItemDefinition>
): boolean => {
    const currentPlugHash = readItemSocketPlugHash(snapshot, itemInstanceId, socketIndex);
    return currentPlugHash ? definitionMatchesAdjustment(definitionsByHash.get(currentPlugHash), plugCategory, adjustment) : false;
};

const findSocketIndexForPlugCategory = (
    snapshot: VaultExportSnapshot,
    itemInstanceId: string,
    definitionsByHash: Map<number, DestinyInventoryItemDefinition>,
    plugCategory: string
): number | null => {
    const sockets = snapshot.profileResponse?.Response?.itemComponents?.sockets?.data?.[itemInstanceId]?.sockets ?? [];
    const reusablePlugs = snapshot.profileResponse?.Response?.itemComponents?.reusablePlugs?.data?.[itemInstanceId]?.plugs ?? {};

    for (const [socketIndex, socket] of sockets.entries()) {
        const definition = socket.plugHash ? definitionsByHash.get(socket.plugHash) : undefined;
        if (definition?.plug?.plugCategoryIdentifier === plugCategory) {
            return socketIndex;
        }
    }

    for (const [socketIndex, plugs] of Object.entries(reusablePlugs)) {
        if (
            plugs.some((plug) => {
                const definition = plug.plugItemHash ? definitionsByHash.get(plug.plugItemHash) : undefined;
                return definition?.plug?.plugCategoryIdentifier === plugCategory;
            })
        ) {
            return Number(socketIndex);
        }
    }

    return null;
};

const findPlugHashForAdjustment = (
    snapshot: VaultExportSnapshot,
    itemInstanceId: string,
    socketIndex: number,
    plugCategory: string,
    adjustment: StatAdjustment,
    definitionsByHash: Map<number, DestinyInventoryItemDefinition>,
    categoryDefinitions: LoadedManifestDefinition[]
): number | null => {
    const directPlugHash = parsePlugHashFromAdjustment(adjustment);
    const reusablePlugHashes = readReusablePlugHashes(snapshot, itemInstanceId, socketIndex, { includeUnavailable: true });
    if (directPlugHash !== null && definitionMatchesAdjustment(definitionsByHash.get(directPlugHash), plugCategory, adjustment)) {
        return directPlugHash;
    }

    for (const plugHash of reusablePlugHashes) {
        if (definitionMatchesAdjustment(definitionsByHash.get(plugHash), plugCategory, adjustment)) {
            return plugHash;
        }
    }

    const manifestDefinition = categoryDefinitions.find(({ definition }) =>
        definitionMatchesAdjustment(definition, plugCategory, adjustment)
    );
    if (manifestDefinition) {
        return manifestDefinition.hash;
    }

    return null;
};

export const collectSocketPlugCategoryDefinitions = (
    manifestDefinitions: LoadedManifestDefinition[],
    getByPlugCategory: ((plugCategory: string) => LoadedManifestDefinition[]) | undefined
): LoadedManifestDefinition[] => [
    ...manifestDefinitions,
    ...(getByPlugCategory?.(GENERAL_ARMOR_MOD_PLUG_CATEGORY) ?? []),
    ...(getByPlugCategory?.(TUNING_PLUG_CATEGORY) ?? [])
];

export const insertBuildSocketPlugs = async (
    token: BungieToken,
    snapshot: VaultExportSnapshot,
    membershipType: number,
    characterId: string,
    build: ArmorBuild,
    categoryDefinitions: LoadedManifestDefinition[],
    onProgress?: (update: EquipProgressUpdate) => void
): Promise<void> => {
    const definitionsByHash = createDefinitionMap(categoryDefinitions);
    const inserted: Array<{ itemName: string; kind: string; socketIndex: number; plugItemHash: number; plugName?: string }> = [];
    const skipped: Array<{ itemName: string; kind: string; reason: string }> = [];

    for (const slot of ARMOR_SLOTS) {
        const piece = build.pieces[slot];
        const itemInstanceId = piece.item.itemInstanceId;
        onProgress?.({
            slot,
            status: 'active',
            detail: `Clearing other mods on ${piece.item.name}`
        });
        const clearedSocketIndices = await clearOtherArmorMods(
            token,
            snapshot,
            membershipType,
            characterId,
            piece.item,
            definitionsByHash,
            onProgress,
            slot
        );

        const socketPlans = [
            {
                kind: 'stat mod',
                plugCategory: GENERAL_ARMOR_MOD_PLUG_CATEGORY,
                adjustment: piece.statMod
            },
            {
                kind: 'tuning',
                plugCategory: TUNING_PLUG_CATEGORY,
                adjustment: piece.tuning
            }
        ] as const;

        for (const plan of socketPlans) {
            const adjustment = plan.adjustment;
            if (!adjustment) {
                skipped.push({
                    itemName: piece.item.name,
                    kind: plan.kind,
                    reason: 'solver returned no socket choice'
                });
                continue;
            }

            onProgress?.({
                slot,
                status: 'active',
                detail: `Applying ${adjustment.name} to ${piece.item.name}`
            });

            const socketIndex = findSocketIndexForPlugCategory(snapshot, itemInstanceId, definitionsByHash, plan.plugCategory);
            if (socketIndex === null) {
                const reason = `could not find ${plan.kind} socket`;
                if (statAdjustmentIsZero(adjustment)) {
                    skipped.push({
                        itemName: piece.item.name,
                        kind: plan.kind,
                        reason
                    });
                    continue;
                }

                throw new Error(`Could not find a ${plan.kind} socket on ${piece.item.name}.`);
            }

            if (
                !clearedSocketIndices.has(socketIndex) &&
                currentSocketMatchesAdjustment(snapshot, itemInstanceId, socketIndex, plan.plugCategory, adjustment, definitionsByHash)
            ) {
                skipped.push({
                    itemName: piece.item.name,
                    kind: plan.kind,
                    reason: 'already socketed'
                });
                continue;
            }

            const plugItemHash = findPlugHashForAdjustment(
                snapshot,
                itemInstanceId,
                socketIndex,
                plan.plugCategory,
                adjustment,
                definitionsByHash,
                categoryDefinitions
            );
            if (plugItemHash === null) {
                throw new Error(`Could not resolve ${adjustment.name} ${plan.kind} for ${piece.item.name}.`);
            }

            try {
                console.debug('[rose bungie api] Inserting socket plug', {
                    itemName: piece.item.name,
                    itemId: itemInstanceId,
                    kind: plan.kind,
                    adjustmentName: adjustment.name,
                    socketIndex,
                    plugItemHash,
                    plugName: definitionsByHash.get(plugItemHash)?.displayProperties?.name
                });
                await insertSocketPlugFree(token, {
                    itemId: itemInstanceId,
                    characterId,
                    membershipType,
                    plug: {
                        socketIndex,
                        socketArrayType: DEFAULT_SOCKET_ARRAY_TYPE,
                        plugItemHash
                    }
                });
            } catch (error) {
                console.error('[rose bungie api] Socket plug insertion failed for build piece', {
                    itemName: piece.item.name,
                    itemId: itemInstanceId,
                    kind: plan.kind,
                    adjustmentName: adjustment.name,
                    socketIndex,
                    plugItemHash,
                    plugName: definitionsByHash.get(plugItemHash)?.displayProperties?.name,
                    error
                });
                throw new Error(
                    `Could not apply ${adjustment.name} to ${piece.item.name}. Bungie rejected the ${plan.kind} socket change.`
                );
            }

            inserted.push(
                createInsertedSocketReport(
                    piece.item.name,
                    plan.kind,
                    socketIndex,
                    plugItemHash,
                    definitionsByHash.get(plugItemHash)?.displayProperties?.name
                )
            );
        }

        onProgress?.({
            slot,
            status: 'done',
            detail: `${piece.item.name} is ready`
        });
    }

    console.debug('[rose bungie api] Socket plug insertion completed', {
        inserted,
        skipped
    });
};

const clearOtherArmorMods = async (
    token: BungieToken,
    snapshot: VaultExportSnapshot,
    membershipType: number,
    characterId: string,
    item: ArmorItem,
    definitionsByHash: Map<number, DestinyInventoryItemDefinition>,
    onProgress: ((update: EquipProgressUpdate) => void) | undefined,
    slot: ArmorSlot
): Promise<Set<number>> => {
    const clearableSockets = readClearableArmorModSockets(snapshot, item.itemInstanceId, definitionsByHash);
    const clearedSocketIndices = new Set<number>();

    for (const socket of clearableSockets) {
        if (
            !socket.emptyPlugHash ||
            socket.currentPlugHash === socket.emptyPlugHash ||
            isEmptySocketPlug(definitionsByHash.get(socket.currentPlugHash ?? 0))
        ) {
            continue;
        }

        const emptyPlugName = definitionsByHash.get(socket.emptyPlugHash)?.displayProperties?.name ?? 'Empty Mod Socket';
        onProgress?.({
            slot,
            status: 'active',
            detail: `Removing ${socket.currentPlugName ?? 'mod'} from ${item.name}`
        });
        console.debug('[rose bungie api] Clearing armor mod socket', {
            itemName: item.name,
            itemId: item.itemInstanceId,
            socketIndex: socket.socketIndex,
            currentPlugHash: socket.currentPlugHash,
            currentPlugName: socket.currentPlugName,
            currentCategory: socket.currentCategory,
            emptyPlugHash: socket.emptyPlugHash,
            emptyPlugName
        });
        await insertSocketPlugFree(token, {
            itemId: item.itemInstanceId,
            characterId,
            membershipType,
            plug: {
                socketIndex: socket.socketIndex,
                socketArrayType: DEFAULT_SOCKET_ARRAY_TYPE,
                plugItemHash: socket.emptyPlugHash
            }
        });
        clearedSocketIndices.add(socket.socketIndex);
    }

    const unclearedSockets = clearableSockets.filter(
        (socket) =>
            !clearedSocketIndices.has(socket.socketIndex) &&
            socket.currentPlugHash &&
            !isEmptySocketPlug(definitionsByHash.get(socket.currentPlugHash))
    );
    if (unclearedSockets.length > 0) {
        console.debug('[rose bungie api] Some armor mod sockets were not cleared', {
            itemName: item.name,
            itemId: item.itemInstanceId,
            sockets: unclearedSockets.map((socket) => ({
                socketIndex: socket.socketIndex,
                currentPlugHash: socket.currentPlugHash,
                currentPlugName: socket.currentPlugName,
                currentCategory: socket.currentCategory,
                emptyPlugHash: socket.emptyPlugHash
            }))
        });
    }

    return clearedSocketIndices;
};
