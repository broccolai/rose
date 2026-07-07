import {
    ARMOR_SLOTS,
    ARMOR_STATS,
    type ArmorBuild,
    type ArmorBuildSort,
    type ArmorItem,
    type ArmorSlot,
    type ArmorStat,
    type ArmorStatTargetCapsInput,
    type SolveArmorInput,
    type SolveArmorResult,
    type StatAdjustment,
    type StatVector
} from '@armor-calc';
import { createEventListener } from '@solid-primitives/event-listener';
import { debounce } from '@solid-primitives/scheduled';
import type {
    DestinyInventoryItemDefinition,
    DestinyItemComponent,
    DestinyItemInstanceComponent,
    DestinyItemSocketsComponent,
    DestinyItemStatsComponent
} from 'bungie-api-ts/destiny2';
import type { UserMembershipData } from 'bungie-api-ts/user';
import { createEffect, createMemo, createSignal, onCleanup, onMount, untrack } from 'solid-js';

import {
    applySetSelectionLimit,
    type CalculatorPreferences,
    clampTarget,
    clearCalculatorPreferences,
    EMPTY_STAT_TARGETS,
    isArmorStat,
    mergeCalculatorPreferencesForStorage,
    readCalculatorPreferences,
    type SetSelectionValue,
    sanitizeArmorSetDisplayMode,
    sanitizeSubclassType,
    sanitizeTargets,
    writeCalculatorPreferences
} from '@/features/armor/calculator-preferences';
import {
    getAvailableExoticOptions,
    getCharacterButtonOptions,
    getResultFailure,
    getSelectableArmorSets,
    getSelectedCharacter,
    getSelectedSetRequirements,
    type ResultSortKey,
    reconcileSelectedExotic,
    reconcileSetSelections,
    sortArmorBuildsForDisplay,
    toggleArmorBuildSort
} from '@/features/armor/calculator-view-model';
import { ArmorAppShell } from '@/features/armor/components/app-shell';
import { AppToolbar, type LoadProgress } from '@/features/armor/components/app-toolbar';
import { CalculatorControls } from '@/features/armor/components/calculator-controls';
import { type EquipPieceStatus, EquipProgressOverlay, type EquipProgressState } from '@/features/armor/components/equip-progress-overlay';
import { ResultsPanel } from '@/features/armor/components/results-panel';
import { createBungieManifestResolver } from '@/features/armor/manifest';
import { makeArmorBySlotForClass, normalizeVaultExport } from '@/features/armor/normalize';
import { type ArmorSetDisplayMode, buildExpansionKey, DEFAULT_RESULT_SORT } from '@/features/armor/result-display';
import { createArmorSolverClient } from '@/features/armor/solver-worker-client';
import { STAT_BY_HASH } from '@/features/armor/stat-hashes';
import {
    formatFragmentBonus,
    fragmentsForSubclass,
    getFragmentByHash,
    inferSubclassTypeFromName,
    type SubclassType,
    sanitizeFragmentIds,
    sumFragmentBonuses
} from '@/features/armor/subclass-fragments';
import {
    applyVerifiedTargetCap,
    clampTargetsToCaps,
    createPendingTargetCaps,
    MAX_STAT_TARGET_CAPS,
    snapStatTarget,
    targetsAreWithinCaps
} from '@/features/armor/target-cap-state';
import type { LoadedManifestDefinition, NormalizedArmorProfile, VaultExportSnapshot } from '@/features/armor/types';
import {
    downloadJsonFile,
    equipDestinyItems,
    exportVaultSnapshot,
    insertSocketPlugFree,
    readCachedVaultSnapshot,
    transferDestinyItem
} from '@/features/bungie/api';
import { getMissingConfigKeys } from '@/features/bungie/config';
import { type BungieToken, createAuthorizationUrl, getTokenDebugState, getValidToken } from '@/features/bungie/oauth';

type Status = 'idle' | 'loading' | 'solving' | 'exporting' | 'error' | 'done';

const SOLVER_RESULT_POOL_LIMIT = 5_000;
const VISIBLE_RESULT_LIMIT = 25;
const BALANCED_TUNING_ENABLED = true;
const AUTH_LOCK_DISABLED = import.meta.env.DEV || import.meta.env.MODE === 'test';
const DEV_TIMING = import.meta.env.DEV;
const BUNGIE_ORIGIN = 'https://www.bungie.net';
const TEST_DATA_ENDPOINT = '/__rose-test-data__/loaded-benchmark-bundle';
const GENERAL_ARMOR_MOD_PLUG_CATEGORY = 'enhancements.v2_general';
const CLEARABLE_ARMOR_MOD_PLUG_CATEGORY_PREFIX = 'enhancements.';
const TUNING_PLUG_CATEGORY = 'core.gear_systems.armor_tiering.plugs.tuning.mods';
const DEFAULT_SOCKET_ARRAY_TYPE = 0;
const MASTERWORK_PLUG_CATEGORY_PREFIX = 'v460.plugs.armor.masterworks';
const SUBCLASS_BUCKET_HASH = 3284755031;

type LoadedBenchmarkBundle = {
    vaultSnapshot?: VaultExportSnapshot;
    normalizedProfile?: NormalizedArmorProfile;
    loadedManifestDefinitions?: LoadedManifestDefinition[];
    manifest?: {
        inventoryItemDefinitions?: Record<string, DestinyInventoryItemDefinition>;
    };
};

type DebugStatComponents = Record<string, DestinyItemStatsComponent>;
type DebugSocketComponents = Record<string, DestinyItemSocketsComponent>;
type DebugInstanceComponents = Record<string, DestinyItemInstanceComponent>;
type EquippedSubclassImport = {
    subclass: SubclassType;
    fragmentIds: string[];
    missingFragmentPlugHashes: number[];
    subclassItemName: string;
    subclassItemHash: number;
    subclassItemInstanceId: string;
};
type EquipItemLocation =
    | {
          location: 'selected-character';
          rank: number;
          item: DestinyItemComponent;
      }
    | {
          location: 'vault';
          rank: number;
          item: DestinyItemComponent;
      }
    | {
          location: 'other-character';
          rank: number;
          characterId: string;
          item: DestinyItemComponent;
      }
    | {
          location: 'other-character-equipped';
          rank: number;
          characterId: string;
          item: DestinyItemComponent;
      };
type EquipProgressUpdate = {
    slot?: ArmorSlot;
    status?: EquipPieceStatus;
    detail: string;
};

function readBungieUser(snapshot: VaultExportSnapshot | null): UserMembershipData['bungieNetUser'] | undefined {
    return snapshot?.membershipsResponse?.Response?.bungieNetUser;
}

function readSnapshotMembershipType(snapshot: VaultExportSnapshot | null) {
    const membershipType = snapshot?.selectedMembership?.membershipType;
    return typeof membershipType === 'number' ? membershipType : null;
}

function findProfileItemLocation(
    snapshot: VaultExportSnapshot,
    itemInstanceId: string,
    selectedCharacterId: string
): EquipItemLocation | null {
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
}

function resolveMovableBuildItem(snapshot: VaultExportSnapshot, item: ArmorItem, selectedCharacterId: string) {
    const candidateIds = [...new Set([item.itemInstanceId, ...(item.equivalentItemInstanceIds ?? [])])];
    const candidates = candidateIds
        .map((itemInstanceId) => {
            const location = findProfileItemLocation(snapshot, itemInstanceId, selectedCharacterId);
            return location ? { itemInstanceId, location } : null;
        })
        .filter((candidate): candidate is { itemInstanceId: string; location: EquipItemLocation } => Boolean(candidate))
        .sort((left, right) => left.location.rank - right.location.rank);

    return candidates[0] ?? null;
}

function createBuildWithResolvedItemIds(build: ArmorBuild, resolvedItemIds: Record<ArmorSlot, string>): ArmorBuild {
    return {
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
    };
}

function absoluteBungieAssetUrl(path?: string) {
    if (!path) {
        return undefined;
    }

    if (path.startsWith('http://') || path.startsWith('https://')) {
        return path;
    }

    return `${BUNGIE_ORIGIN}${path}`;
}

function isEditableKeyboardTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) {
        return false;
    }

    return (
        target.isContentEditable ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLTextAreaElement
    );
}

function isLocalDevHost() {
    if (typeof window === 'undefined') {
        return false;
    }

    return ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
}

function canLoadLocalTestData() {
    return AUTH_LOCK_DISABLED || isLocalDevHost();
}

function elapsedMs(startedAt: number) {
    return Math.round((performance.now() - startedAt) * 10) / 10;
}

function logDevTiming(label: string, details: Record<string, unknown>) {
    if (!DEV_TIMING) {
        return;
    }

    console.debug(`[rose timing] ${label}`, details);
}

function armorSlotCounts(input: ArmorStatTargetCapsInput | SolveArmorInput) {
    return Object.fromEntries(Object.entries(input.armor).map(([slot, armor]) => [slot, armor.length]));
}

function filterFullyMasterworkedProfile(profile: NormalizedArmorProfile | null, enabled: boolean) {
    if (!profile || !enabled) {
        return profile;
    }

    const armor = profile.armor.map((item) => keepFullyMasterworkedItem(item)).filter((item): item is ArmorItem => Boolean(item));

    return {
        ...profile,
        armor,
        armorBySlot: groupArmorBySlotForProfile(armor)
    };
}

function keepFullyMasterworkedItem(item: ArmorItem): ArmorItem | null {
    const fullyMasterworkedIds = item.fullyMasterworkedItemInstanceIds ?? (item.isCurrentMasterworked ? [item.itemInstanceId] : []);
    if (fullyMasterworkedIds.length === 0) {
        return null;
    }

    return {
        ...item,
        itemInstanceId: fullyMasterworkedIds[0],
        equivalentItemInstanceIds: fullyMasterworkedIds,
        fullyMasterworkedItemInstanceIds: fullyMasterworkedIds,
        isCurrentMasterworked: true
    };
}

function groupArmorBySlotForProfile(armor: ArmorItem[]) {
    return Object.fromEntries(
        ARMOR_SLOTS.map((slot) => [slot, armor.filter((item) => item.slot === slot)])
    ) as NormalizedArmorProfile['armorBySlot'];
}

function setSelectionRecordsEqual(left: Record<string, SetSelectionValue>, right: Record<string, SetSelectionValue>) {
    const leftEntries = Object.entries(left);
    const rightEntries = Object.entries(right);
    return leftEntries.length === rightEntries.length && leftEntries.every(([key, value]) => right[key] === value);
}

function createInitialEquipProgress(build: ArmorBuild): EquipProgressState {
    return {
        active: true,
        title: 'Applying build',
        detail: 'Preparing armor changes',
        canDismiss: false,
        pieces: ARMOR_SLOTS.map((slot) => ({
            slot,
            itemName: build.pieces[slot].item.name,
            status: 'pending',
            detail: 'Waiting'
        }))
    };
}

function createDebugArmorReport(
    snapshot: VaultExportSnapshot | null,
    profile: NormalizedArmorProfile | null,
    definitions: LoadedManifestDefinition[]
) {
    if (!snapshot || !profile) {
        return {
            available: false,
            reason: 'No loaded vault snapshot or normalized profile.'
        };
    }

    const definitionByHash = new Map(definitions.map(({ hash, definition }) => [hash, definition]));
    const profileResponse = snapshot.profileResponse?.Response;
    const statComponents = profileResponse?.itemComponents?.stats?.data ?? {};
    const socketComponents = profileResponse?.itemComponents?.sockets?.data ?? {};
    const instanceComponents = profileResponse?.itemComponents?.instances?.data ?? {};

    return {
        available: true,
        note: 'rose assumes every normalized armor item is fully masterworked. currentMasterwork describes only what Bungie reported as socketed right now.',
        armor: profile.armor.map((item) => {
            const instanceIds = [item.itemInstanceId, ...(item.equivalentItemInstanceIds ?? [])];

            return {
                itemInstanceId: item.itemInstanceId,
                equivalentItemInstanceIds: item.equivalentItemInstanceIds ?? [],
                itemHash: item.itemHash,
                name: item.name,
                slot: item.slot,
                classType: item.classType,
                tier: item.tier,
                isExotic: item.isExotic,
                normalizedBaseStats: item.baseStats,
                normalizedBaseTotal: statTotalDebug(item.baseStats),
                normalizedTuningOptions: item.tuningOptions.map((option) => ({
                    id: option.id,
                    name: option.name,
                    deltas: option.deltas
                })),
                instances: instanceIds.map((itemInstanceId) =>
                    createDebugArmorInstanceReport(itemInstanceId, statComponents, socketComponents, instanceComponents, definitionByHash)
                )
            };
        })
    };
}

function createDebugArmorInstanceReport(
    itemInstanceId: string,
    statComponents: DebugStatComponents,
    socketComponents: DebugSocketComponents,
    instanceComponents: DebugInstanceComponents,
    definitionByHash: Map<number, DestinyInventoryItemDefinition>
) {
    const rawStats = readDebugStats(statComponents?.[itemInstanceId]?.stats ?? {});
    const sockets = socketComponents?.[itemInstanceId]?.sockets ?? [];
    const socketReports = sockets.map((socket, socketIndex) => createDebugSocketReport(socket.plugHash, socketIndex, definitionByHash));
    const masterworkSockets = socketReports.filter((socket) => socket.plugCategory?.startsWith(MASTERWORK_PLUG_CATEGORY_PREFIX));
    const currentMasterworkStats = sumDebugStats(masterworkSockets.map((socket) => socket.deltas));

    return {
        itemInstanceId,
        gearTier: instanceComponents?.[itemInstanceId]?.gearTier,
        rawDisplayedStats: rawStats,
        rawDisplayedTotal: statTotalDebug(rawStats),
        currentMasterwork: {
            detected: masterworkSockets.length > 0,
            plugCount: masterworkSockets.length,
            total: statTotalDebug(currentMasterworkStats),
            deltas: currentMasterworkStats,
            plugs: masterworkSockets.map(({ socketIndex, plugHash, name, plugCategory, deltas }) => ({
                socketIndex,
                plugHash,
                name,
                plugCategory,
                deltas
            })),
            roseAssumption:
                masterworkSockets.length > 0
                    ? 'socketed masterwork was detected in raw Bungie data'
                    : 'no socketed masterwork plug detected; rose still assumes fully masterworked for solving'
        },
        sockets: socketReports
    };
}

function createDebugSocketReport(
    plugHash: number | undefined,
    socketIndex: number,
    definitionByHash: Map<number, DestinyInventoryItemDefinition>
) {
    const definition = plugHash ? definitionByHash.get(plugHash) : undefined;

    return {
        socketIndex,
        plugHash,
        name: definition?.displayProperties?.name,
        description: definition?.displayProperties?.description,
        plugCategory: definition?.plug?.plugCategoryIdentifier,
        deltas: definition ? readDebugInvestmentStats(definition) : emptyDebugStats()
    };
}

function readDebugStats(stats: DestinyItemStatsComponent['stats']): StatVector {
    const normalized = emptyDebugStats();

    for (const [statHash, statValue] of Object.entries(stats)) {
        const stat = STAT_BY_HASH[statHash];
        if (stat) {
            normalized[stat] = statValue.value ?? 0;
        }
    }

    return normalized;
}

function readDebugInvestmentStats(definition: DestinyInventoryItemDefinition): StatVector {
    const normalized = emptyDebugStats();

    for (const investmentStat of definition.investmentStats ?? []) {
        const stat = STAT_BY_HASH[String(investmentStat.statTypeHash)];
        if (stat) {
            normalized[stat] += investmentStat.value;
        }
    }

    return normalized;
}

function sumDebugStats(vectors: StatVector[]): StatVector {
    const total = emptyDebugStats();

    for (const vector of vectors) {
        for (const stat of ARMOR_STATS) {
            total[stat] += vector[stat];
        }
    }

    return total;
}

function emptyDebugStats(): StatVector {
    return {
        health: 0,
        melee: 0,
        grenade: 0,
        super: 0,
        class: 0,
        weapons: 0
    };
}

function statTotalDebug(stats: StatVector) {
    return ARMOR_STATS.reduce((total, stat) => total + stats[stat], 0);
}

function createDefinitionMap(definitions: LoadedManifestDefinition[]) {
    return new Map(definitions.map(({ hash, definition }) => [hash, definition]));
}

function statAdjustmentIsZero(adjustment: StatAdjustment) {
    return ARMOR_STATS.every((stat) => (adjustment.deltas[stat] ?? 0) === 0);
}

function statVectorMatchesAdjustment(stats: StatVector, adjustment: StatAdjustment) {
    return ARMOR_STATS.every((stat) => stats[stat] === (adjustment.deltas[stat] ?? 0));
}

function definitionMatchesAdjustment(
    definition: DestinyInventoryItemDefinition | undefined,
    plugCategory: string,
    adjustment: StatAdjustment
) {
    return (
        definition?.plug?.plugCategoryIdentifier === plugCategory &&
        statVectorMatchesAdjustment(readDebugInvestmentStats(definition), adjustment)
    );
}

function parsePlugHashFromAdjustment(adjustment: StatAdjustment) {
    const match = /^plug:(\d+)$/.exec(adjustment.id);
    return match ? Number(match[1]) : null;
}

function readItemSocketPlugHash(snapshot: VaultExportSnapshot, itemInstanceId: string, socketIndex: number) {
    return snapshot.profileResponse?.Response?.itemComponents?.sockets?.data?.[itemInstanceId]?.sockets?.[socketIndex]?.plugHash;
}

function readReusablePlugHashes(
    snapshot: VaultExportSnapshot,
    itemInstanceId: string,
    socketIndex: number,
    options: { includeUnavailable?: boolean } = {}
) {
    const plugs = snapshot.profileResponse?.Response?.itemComponents?.reusablePlugs?.data?.[itemInstanceId]?.plugs ?? {};
    return (plugs[socketIndex] ?? [])
        .filter((plug) => options.includeUnavailable || (plug.canInsert !== false && plug.enabled !== false))
        .map((plug) => plug.plugItemHash)
        .filter((hash): hash is number => typeof hash === 'number');
}

function collectItemSocketPlugHashes(snapshot: VaultExportSnapshot, itemInstanceIds: string[]) {
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
}

function isEmptySocketPlug(definition: DestinyInventoryItemDefinition | undefined) {
    const name = definition?.displayProperties?.name?.toLowerCase() ?? '';
    return name.includes('empty') && definition ? statTotalDebug(readDebugInvestmentStats(definition)) === 0 : false;
}

function isClearableArmorModCategory(plugCategory: string | undefined) {
    return Boolean(plugCategory?.startsWith(CLEARABLE_ARMOR_MOD_PLUG_CATEGORY_PREFIX));
}

function findEmptyPlugHashForSocket(
    snapshot: VaultExportSnapshot,
    itemInstanceId: string,
    socketIndex: number,
    definitionsByHash: Map<number, DestinyInventoryItemDefinition>
) {
    return (
        readReusablePlugHashes(snapshot, itemInstanceId, socketIndex, { includeUnavailable: true }).find((plugHash) =>
            isEmptySocketPlug(definitionsByHash.get(plugHash))
        ) ?? null
    );
}

function readClearableArmorModSockets(
    snapshot: VaultExportSnapshot,
    itemInstanceId: string,
    definitionsByHash: Map<number, DestinyInventoryItemDefinition>
) {
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
}

function currentSocketMatchesAdjustment(
    snapshot: VaultExportSnapshot,
    itemInstanceId: string,
    socketIndex: number,
    plugCategory: string,
    adjustment: StatAdjustment,
    definitionsByHash: Map<number, DestinyInventoryItemDefinition>
) {
    const currentPlugHash = readItemSocketPlugHash(snapshot, itemInstanceId, socketIndex);
    return currentPlugHash ? definitionMatchesAdjustment(definitionsByHash.get(currentPlugHash), plugCategory, adjustment) : false;
}

function findSocketIndexForPlugCategory(
    snapshot: VaultExportSnapshot,
    itemInstanceId: string,
    definitionsByHash: Map<number, DestinyInventoryItemDefinition>,
    plugCategory: string
) {
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
}

function findPlugHashForAdjustment(
    snapshot: VaultExportSnapshot,
    itemInstanceId: string,
    socketIndex: number,
    plugCategory: string,
    adjustment: StatAdjustment,
    definitionsByHash: Map<number, DestinyInventoryItemDefinition>,
    categoryDefinitions: LoadedManifestDefinition[]
) {
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
}

async function insertBuildSocketPlugs(
    token: BungieToken,
    snapshot: VaultExportSnapshot,
    membershipType: number,
    characterId: string,
    build: ArmorBuild,
    categoryDefinitions: LoadedManifestDefinition[],
    onProgress?: (update: EquipProgressUpdate) => void
) {
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

            inserted.push({
                itemName: piece.item.name,
                kind: plan.kind,
                socketIndex,
                plugItemHash,
                plugName: definitionsByHash.get(plugItemHash)?.displayProperties?.name
            });
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
}

async function clearOtherArmorMods(
    token: BungieToken,
    snapshot: VaultExportSnapshot,
    membershipType: number,
    characterId: string,
    item: ArmorItem,
    definitionsByHash: Map<number, DestinyInventoryItemDefinition>,
    onProgress: ((update: EquipProgressUpdate) => void) | undefined,
    slot: ArmorSlot
) {
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
}

function createDebugExpandedResultReport(builds: ArmorBuild[], expandedBuildKey: string | null) {
    if (!expandedBuildKey) {
        return {
            available: false,
            reason: 'No result row is expanded.'
        };
    }

    const buildIndex = builds.findIndex((build) => buildExpansionKey(build) === expandedBuildKey);
    if (buildIndex < 0) {
        return {
            available: false,
            expandedBuildKey,
            reason: 'The expanded result is no longer present in the retained result list.'
        };
    }

    const build = builds[buildIndex];

    return {
        available: true,
        expandedBuildKey,
        retainedResultIndex: buildIndex,
        displayRank: buildIndex + 1,
        stats: build.stats,
        totalStats: build.score.totalStats,
        build
    };
}

async function readEquippedSubclassImport(
    snapshot: VaultExportSnapshot,
    characterId: string,
    definitions: LoadedManifestDefinition[],
    loadDefinition: (hash: number) => Promise<DestinyInventoryItemDefinition | null>
): Promise<EquippedSubclassImport | null> {
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
}

export default function Home() {
    let targetCapRequestId = 0;
    let solveRequestId = 0;
    let debugExportChordActive = false;
    let solveInvalidationSuspended = 0;
    const armorSolver = createArmorSolverClient();
    const [status, setStatus] = createSignal<Status>('idle');
    const [_message, setMessage] = createSignal('Checking local token...');
    const [authenticated, setAuthenticated] = createSignal(false);
    const [loadProgress, setLoadProgress] = createSignal<LoadProgress>({
        active: false,
        label: '',
        current: 0,
        total: 0,
        percent: 0
    });
    const [normalizedProfile, setNormalizedProfile] = createSignal<NormalizedArmorProfile | null>(null);
    const [loadedSnapshot, setLoadedSnapshot] = createSignal<VaultExportSnapshot | null>(null);
    const [loadedManifestDefinitions, setLoadedManifestDefinitions] = createSignal<LoadedManifestDefinition[]>([]);
    const [selectedCharacterId, setSelectedCharacterId] = createSignal('');
    const [selectedExoticItemHash, setSelectedExoticItemHash] = createSignal('');
    const [armorSetDisplayMode, setArmorSetDisplayMode] = createSignal<ArmorSetDisplayMode>('sets');
    const [selectedSubclass, setSelectedSubclass] = createSignal<SubclassType>('Prismatic');
    const [selectedFragmentIds, setSelectedFragmentIds] = createSignal<string[]>([]);
    const [dumpStat, setDumpStat] = createSignal<ArmorStat | ''>('');
    const [allowBalancedTuning, setAllowBalancedTuning] = createSignal(false);
    const [onlyFullyMasterworkedGear, setOnlyFullyMasterworkedGear] = createSignal(false);
    const [targets, setTargets] = createSignal<StatVector>({ ...EMPTY_STAT_TARGETS });
    const [targetCaps, setTargetCaps] = createSignal<StatVector>({ ...MAX_STAT_TARGET_CAPS });
    const [targetCapsPending, setTargetCapsPending] = createSignal(false);
    const [targetCapCalculationActive, setTargetCapCalculationActive] = createSignal(false);
    const [targetCapPriorityStat, setTargetCapPriorityStat] = createSignal<ArmorStat | null>(null);
    const [nextTargetCapRefreshBackground, setNextTargetCapRefreshBackground] = createSignal(false);
    const [setSelections, setSetSelections] = createSignal<Record<string, SetSelectionValue>>({});
    const [resultSort, setResultSort] = createSignal<ArmorBuildSort>(DEFAULT_RESULT_SORT);
    const [solveResult, setSolveResult] = createSignal<SolveArmorResult | null>(null);
    const [expandedBuildKey, setExpandedBuildKey] = createSignal<string | null>(null);
    const [equipProgress, setEquipProgress] = createSignal<EquipProgressState | null>(null);
    const [equipOperationActive, setEquipOperationActive] = createSignal(false);
    const [preferencesLoaded, setPreferencesLoaded] = createSignal(false);
    const dismissCompletedEquipProgress = debounce(() => {
        setEquipProgress((current) => (current?.detail === 'Build applied' ? null : current));
    }, 1400);
    const calculatorProfile = createMemo(() => filterFullyMasterworkedProfile(normalizedProfile(), onlyFullyMasterworkedGear()));
    const selectedCharacter = createMemo(() => getSelectedCharacter(calculatorProfile(), selectedCharacterId()));
    const characterButtons = createMemo(() => getCharacterButtonOptions(normalizedProfile()));
    const availableExotics = createMemo(() => getAvailableExoticOptions(calculatorProfile(), selectedCharacter()));
    const selectableSets = createMemo(() => getSelectableArmorSets(calculatorProfile(), selectedCharacter()));
    const resultBuilds = createMemo(() => {
        const result = solveResult();
        if (!result?.ok) {
            return [];
        }

        return sortArmorBuildsForDisplay(result.builds, resultSort());
    });
    const resultFailure = createMemo(() => getResultFailure(solveResult()));
    const showTuningResults = createMemo(() => true);
    const calculatorLocked = createMemo(() => !AUTH_LOCK_DISABLED && !isLocalDevHost() && !authenticated());
    const bungieUser = createMemo(() => readBungieUser(loadedSnapshot()));
    const avatarUrl = createMemo(() => absoluteBungieAssetUrl(bungieUser()?.profilePicturePath));
    const avatarLabel = createMemo(
        () => bungieUser()?.cachedBungieGlobalDisplayName ?? bungieUser()?.uniqueName ?? bungieUser()?.displayName ?? 'Signed in'
    );

    const selectedSetRequirements = createMemo(() => getSelectedSetRequirements(selectableSets(), setSelections()));
    const effectiveAllowBalancedTuning = createMemo(() => BALANCED_TUNING_ENABLED && allowBalancedTuning());
    const selectedFragmentBonuses = createMemo(() => sumFragmentBonuses(selectedFragmentIds()));
    const selectedFragmentDetails = createMemo(() => {
        const selectedIds = new Set(selectedFragmentIds());

        return fragmentsForSubclass(selectedSubclass())
            .filter((fragment) => selectedIds.has(fragment.id))
            .map((fragment) => ({
                id: fragment.id,
                name: fragment.name,
                subclass: fragment.subclass,
                hash: fragment.hash,
                bonuses: fragment.bonuses,
                label: formatFragmentBonus(fragment)
            }));
    });
    const targetCapInput = createMemo(() => {
        const profile = calculatorProfile();
        const character = selectedCharacter();

        if (!profile || !character) {
            return null;
        }

        return {
            characterId: character.characterId,
            classType: character.classType,
            selectedExoticItemHash: selectedExoticItemHash() ? Number(selectedExoticItemHash()) : undefined,
            dumpStat: dumpStat() || undefined,
            allowBalancedTuning: effectiveAllowBalancedTuning(),
            statTargets: targets(),
            statBonuses: selectedFragmentBonuses(),
            setRequirements: selectedSetRequirements(),
            armor: makeArmorBySlotForClass(profile.armor, character.classType)
        };
    });

    function toggleResultSort(key: ResultSortKey) {
        setResultSort(toggleArmorBuildSort(resultSort(), key));
    }

    function nextTargetCapRequestId() {
        targetCapRequestId += 1;
        return targetCapRequestId;
    }

    async function calculateTargetCapsIncrementally(
        input: ArmorStatTargetCapsInput,
        requestId: number,
        initialCaps: StatVector,
        priorityStat: ArmorStat | null
    ) {
        const nextCaps = { ...initialCaps };
        const startedAt = performance.now();
        logDevTiming('cap batch started', {
            requestId,
            priorityStat,
            targets: input.statTargets,
            initialCaps,
            setRequirements: input.setRequirements.length,
            armorCounts: armorSlotCounts(input)
        });
        try {
            if (priorityStat) {
                const cap = await armorSolver.calculateStatCap(input, priorityStat);
                if (requestId !== targetCapRequestId) {
                    logDevTiming('priority cap ignored after supersede', {
                        requestId,
                        priorityStat,
                        cap,
                        currentRequestId: targetCapRequestId
                    });
                    return;
                }

                const verifiedCaps = applyVerifiedTargetCap(nextCaps, priorityStat, cap, dumpStat());
                nextCaps[priorityStat] = verifiedCaps[priorityStat];
                setTargetCaps(verifiedCaps);
                setTargetCapPriorityStat(null);
                setTargetCapsPending(false);

                const requestedTarget = input.statTargets[priorityStat] ?? 0;
                if (requestedTarget > verifiedCaps[priorityStat]) {
                    setNextTargetCapRefreshBackground(true);
                    setTargets((current) => clampTargetsToCaps(current, verifiedCaps, dumpStat(), effectiveAllowBalancedTuning()));
                    invalidateSolve();
                    setTargetCapCalculationActive(false);
                    logDevTiming('priority cap clamped target', {
                        requestId,
                        priorityStat,
                        requested: requestedTarget,
                        cap: verifiedCaps[priorityStat],
                        ms: elapsedMs(startedAt)
                    });
                    return;
                }
            }

            const remainingStats = priorityStat ? ARMOR_STATS.filter((stat) => stat !== priorityStat) : ARMOR_STATS;
            await armorSolver.calculateStatCaps(input, remainingStats, (stat, cap) => {
                if (requestId !== targetCapRequestId) {
                    logDevTiming('cap stat ignored after supersede', {
                        requestId,
                        stat,
                        cap,
                        currentRequestId: targetCapRequestId
                    });
                    return;
                }

                const verifiedCaps = applyVerifiedTargetCap(nextCaps, stat, cap, dumpStat());
                nextCaps[stat] = verifiedCaps[stat];
                setTargetCaps(verifiedCaps);
            });
            if (requestId === targetCapRequestId) {
                setTargetCapsPending(false);
                setTargetCapCalculationActive(false);
                logDevTiming('cap batch completed', {
                    requestId,
                    ms: elapsedMs(startedAt),
                    caps: nextCaps
                });
            } else {
                logDevTiming('cap batch completed stale', {
                    requestId,
                    currentRequestId: targetCapRequestId,
                    ms: elapsedMs(startedAt)
                });
            }
        } catch (error) {
            if (error instanceof Error && error.message === 'Armor solver request superseded.') {
                logDevTiming('cap batch superseded', {
                    requestId,
                    currentRequestId: targetCapRequestId,
                    ms: elapsedMs(startedAt)
                });
                return;
            }

            if (requestId !== targetCapRequestId) {
                logDevTiming('cap batch failed stale', {
                    requestId,
                    currentRequestId: targetCapRequestId,
                    ms: elapsedMs(startedAt)
                });
                return;
            }

            setMessage(error instanceof Error ? error.message : 'Unknown armor stat cap worker failure.');
            setTargetCapsPending(false);
            setTargetCapCalculationActive(false);
            logDevTiming('cap batch failed', {
                requestId,
                ms: elapsedMs(startedAt),
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    function invalidateSolve() {
        if (solveInvalidationSuspended > 0) {
            logDevTiming('solve invalidation suspended', {
                depth: solveInvalidationSuspended
            });
            return;
        }

        solveRequestId += 1;
        setSolveResult(null);
        setExpandedBuildKey(null);
        if (status() === 'solving') {
            setStatus('idle');
        }
        if (status() !== 'loading' && status() !== 'exporting') {
            setLoadProgress({ active: false, label: '', current: 0, total: 0, percent: 0 });
        }
    }

    async function preserveSolveDuring<T>(operation: () => Promise<T>) {
        solveInvalidationSuspended += 1;
        try {
            return await operation();
        } finally {
            solveInvalidationSuspended = Math.max(0, solveInvalidationSuspended - 1);
        }
    }

    function updateEquipProgress(update: EquipProgressUpdate) {
        setEquipProgress((current) => {
            if (!current) {
                return current;
            }

            return {
                ...current,
                detail: update.detail,
                pieces: current.pieces.map((piece) =>
                    piece.slot === update.slot
                        ? {
                              ...piece,
                              status: update.status ?? piece.status,
                              detail: update.detail
                          }
                        : piece
                )
            };
        });
    }

    function finishEquipProgress(detail: string, failedSlot?: ArmorSlot) {
        setEquipProgress((current) => {
            if (!current) {
                return current;
            }

            return {
                ...current,
                detail,
                canDismiss: true,
                pieces: current.pieces.map((piece) => ({
                    ...piece,
                    status: failedSlot && piece.slot === failedSlot ? 'failed' : piece.status
                }))
            };
        });
    }

    function resetBuildChoices() {
        setSelectedExoticItemHash('');
        setArmorSetDisplayMode('sets');
        setSelectedSubclass('Prismatic');
        setSelectedFragmentIds([]);
        setDumpStat('');
        setAllowBalancedTuning(false);
        setOnlyFullyMasterworkedGear(false);
        setTargets({ ...EMPTY_STAT_TARGETS });
        setTargetCaps({ ...MAX_STAT_TARGET_CAPS });
        setTargetCapsPending(false);
        setTargetCapCalculationActive(false);
        setTargetCapPriorityStat(null);
        setNextTargetCapRefreshBackground(false);
        setSetSelections({});
        setResultSort(DEFAULT_RESULT_SORT);
    }

    function selectCharacter(characterId: string) {
        if (characterId === selectedCharacterId()) {
            return;
        }

        setSelectedCharacterId(characterId);
        resetBuildChoices();
        invalidateSolve();
    }

    function refreshAuthState() {
        const debugState = getTokenDebugState();
        setAuthenticated(debugState.authenticated);
        setMessage(
            debugState.authenticated
                ? `Signed in. Access expires at ${debugState.expiresAt}.${debugState.refreshExpiresAt ? ` Refresh expires at ${debugState.refreshExpiresAt}.` : ''}`
                : 'Signed out.'
        );
    }

    function downloadDebugVaultExport() {
        downloadJsonFile(
            {
                metadata: {
                    app: 'rose-debug-vault-export',
                    exportVersion: 1,
                    exportedAt: new Date().toISOString(),
                    location: window.location.href
                },
                auth: {
                    authenticated: authenticated()
                },
                calculator: {
                    status: status(),
                    selectedCharacterId: selectedCharacterId(),
                    selectedCharacter: selectedCharacter(),
                    selectedExoticItemHash: selectedExoticItemHash(),
                    armorSetDisplayMode: armorSetDisplayMode(),
                    selectedSubclass: selectedSubclass(),
                    selectedFragmentIds: selectedFragmentIds(),
                    selectedFragments: selectedFragmentDetails(),
                    selectedFragmentBonuses: selectedFragmentBonuses(),
                    dumpStat: dumpStat(),
                    allowBalancedTuning: effectiveAllowBalancedTuning(),
                    onlyFullyMasterworkedGear: onlyFullyMasterworkedGear(),
                    targets: targets(),
                    targetCaps: targetCaps(),
                    targetCapsPending: targetCapsPending(),
                    setSelections: setSelections(),
                    selectedSetRequirements: selectedSetRequirements(),
                    resultSort: resultSort()
                },
                vaultSnapshot: loadedSnapshot(),
                normalizedProfile: normalizedProfile(),
                loadedManifestDefinitions: loadedManifestDefinitions(),
                debug: {
                    fragments: {
                        selectedSubclass: selectedSubclass(),
                        selectedFragmentIds: selectedFragmentIds(),
                        selectedFragments: selectedFragmentDetails(),
                        selectedFragmentBonuses: selectedFragmentBonuses()
                    },
                    maximizedResult: createDebugExpandedResultReport(resultBuilds(), expandedBuildKey()),
                    armor: createDebugArmorReport(loadedSnapshot(), normalizedProfile(), loadedManifestDefinitions())
                },
                solveResult: solveResult()
            },
            'rose-debug-vault-export'
        );
        setMessage('Debug vault export downloaded.');
    }

    onMount(() => {
        refreshAuthState();
        applyCalculatorPreferences(readCalculatorPreferences());
        setPreferencesLoaded(true);
        void loadInitialCalculatorData();

        const pressedKeys = new Set<string>();
        const handleKeyDown = (event: KeyboardEvent) => {
            if (isEditableKeyboardTarget(event.target)) {
                return;
            }

            pressedKeys.add(event.key.toLowerCase());
            const shouldExport = pressedKeys.has('k') && pressedKeys.has('o');
            if (!shouldExport || debugExportChordActive) {
                return;
            }

            debugExportChordActive = true;
            event.preventDefault();
            downloadDebugVaultExport();
        };
        const handleKeyUp = (event: KeyboardEvent) => {
            pressedKeys.delete(event.key.toLowerCase());
            if (!pressedKeys.has('k') || !pressedKeys.has('o')) {
                debugExportChordActive = false;
            }
        };

        createEventListener(window, 'keydown', handleKeyDown);
        createEventListener(window, 'keyup', handleKeyUp);
    });

    onCleanup(() => {
        armorSolver.dispose();
    });

    createEffect(() => {
        if (!preferencesLoaded()) {
            return;
        }

        const currentPreferences = {
            selectedCharacterId: selectedCharacterId(),
            selectedExoticItemHash: selectedExoticItemHash(),
            armorSetDisplayMode: armorSetDisplayMode(),
            selectedSubclass: selectedSubclass(),
            selectedFragmentIds: selectedFragmentIds(),
            dumpStat: dumpStat(),
            allowBalancedTuning: effectiveAllowBalancedTuning(),
            onlyFullyMasterworkedGear: onlyFullyMasterworkedGear(),
            targets: targets(),
            setSelections: setSelections(),
            resultSort: resultSort()
        };

        writeCalculatorPreferences(
            mergeCalculatorPreferencesForStorage(readCalculatorPreferences(), currentPreferences, Boolean(normalizedProfile()))
        );
    });

    createEffect(() => {
        if (equipOperationActive()) {
            return;
        }

        const caps = targetCaps();
        const currentDumpStat = dumpStat();
        let changed = false;

        setTargets((current) => {
            const next = clampTargetsToCaps(current, caps, currentDumpStat, effectiveAllowBalancedTuning());
            changed = next !== current;

            return next;
        });

        if (changed) {
            invalidateSolve();
        }
    });

    createEffect(() => {
        if (equipOperationActive()) {
            return;
        }

        const profile = calculatorProfile();
        const character = selectedCharacter();
        if (!profile || !character) {
            return;
        }

        const nextExotic = reconcileSelectedExotic(profile, character.classType, selectedExoticItemHash());
        if (nextExotic !== selectedExoticItemHash()) {
            setSelectedExoticItemHash(nextExotic);
            invalidateSolve();
        }

        const nextSelections = reconcileSetSelections(profile, character.classType, setSelections());
        if (!setSelectionRecordsEqual(setSelections(), nextSelections)) {
            setSetSelections(nextSelections);
            invalidateSolve();
        }
    });

    createEffect(() => {
        if (equipOperationActive()) {
            return;
        }

        const input = targetCapInput();
        const currentDumpStat = dumpStat();
        const priorityStat = untrack(targetCapPriorityStat);
        const backgroundOnly = untrack(nextTargetCapRefreshBackground);
        setNextTargetCapRefreshBackground(false);
        const requestId = nextTargetCapRequestId();

        armorSolver.cancelPending();

        if (!input) {
            setTargetCaps({ ...MAX_STAT_TARGET_CAPS });
            setTargetCapsPending(false);
            setTargetCapCalculationActive(false);
            return;
        }

        const initialCaps = createPendingTargetCaps(untrack(targets), currentDumpStat);
        setTargetCaps(initialCaps);
        setTargetCapsPending(!backgroundOnly);
        setTargetCapCalculationActive(true);

        void calculateTargetCapsIncrementally(input, requestId, initialCaps, priorityStat);
    });

    function signIn() {
        const missingKeys = getMissingConfigKeys();
        if (missingKeys.length > 0) {
            setStatus('error');
            setMessage(`Missing config: ${missingKeys.join(', ')}`);
            return;
        }

        window.location.href = createAuthorizationUrl();
    }

    async function loadCalculatorData() {
        if (equipOperationActive()) {
            setMessage('Finish applying the current build before refreshing.');
            return;
        }

        if (await loadLocalTestCalculatorData()) {
            return;
        }

        const token = await getValidToken();
        if (!token) {
            setAuthenticated(false);
            setStatus('error');
            setMessage('Missing or expired Bungie sign-in. Sign in again.');
            return;
        }

        try {
            setStatus('loading');
            setMessage('Fetching profile from Bungie, then checking local manifest cache...');
            setLoadProgress({
                active: true,
                label: 'Fetching Bungie profile',
                current: 0,
                total: 0,
                percent: 8
            });
            const nextSnapshot = (await exportVaultSnapshot(token)) as VaultExportSnapshot;
            await applyLoadedCalculatorData(nextSnapshot, 'Bungie refresh');
        } catch (error) {
            setStatus('error');
            setLoadProgress({ active: false, label: '', current: 0, total: 0, percent: 0 });
            setMessage(error instanceof Error ? error.message : 'Unknown calculator load failure.');
        }
    }

    async function loadInitialCalculatorData() {
        if (equipOperationActive()) {
            return;
        }

        if (await loadLocalTestCalculatorData({ silentMissing: true })) {
            return;
        }

        const token = await getValidToken();
        if (!token) {
            await loadCachedCalculatorData({ silentMissing: true });
            return;
        }

        setAuthenticated(true);
        try {
            setStatus('loading');
            setMessage('Refreshing profile from Bungie...');
            setLoadProgress({
                active: true,
                label: 'Refreshing Bungie profile',
                current: 0,
                total: 0,
                percent: 8
            });
            const nextSnapshot = (await exportVaultSnapshot(token)) as VaultExportSnapshot;
            await applyLoadedCalculatorData(nextSnapshot, 'Bungie refresh');
        } catch (error) {
            await loadCachedCalculatorData({ silentMissing: true });
            setMessage(
                error instanceof Error
                    ? `Refresh failed; loaded cache if available. ${error.message}`
                    : 'Refresh failed; loaded cache if available.'
            );
        }
    }

    async function loadLocalTestCalculatorData(options: { silentMissing?: boolean } = {}) {
        if (equipOperationActive()) {
            return false;
        }

        if (!canLoadLocalTestData()) {
            return false;
        }

        try {
            setStatus('loading');
            setMessage('Loading local test armor data...');
            setLoadProgress({
                active: true,
                label: 'Reading local test data',
                current: 0,
                total: 0,
                percent: 12
            });

            const response = await fetch(TEST_DATA_ENDPOINT, { cache: 'no-store' });
            if (response.status === 404) {
                setStatus(options.silentMissing ? 'idle' : 'error');
                setLoadProgress({ active: false, label: '', current: 0, total: 0, percent: 0 });
                setMessage(
                    options.silentMissing
                        ? 'No local test data found. Sign in and refresh once.'
                        : 'No local test data found in data/private.'
                );
                return false;
            }

            if (!response.ok) {
                throw new Error(`Local test data request failed (${response.status})`);
            }

            const bundle = (await response.json()) as LoadedBenchmarkBundle;
            if (!bundle.normalizedProfile) {
                throw new Error('Local test data bundle does not contain a normalized profile.');
            }

            applyLoadedNormalizedCalculatorData(
                bundle.normalizedProfile,
                bundle.vaultSnapshot ?? null,
                bundle.loadedManifestDefinitions ??
                    Object.entries(bundle.manifest?.inventoryItemDefinitions ?? {}).map(([hash, definition]) => ({
                        hash: Number(hash),
                        definition
                    })),
                'local test data'
            );
            return true;
        } catch (error) {
            setStatus('error');
            setLoadProgress({ active: false, label: '', current: 0, total: 0, percent: 0 });
            setMessage(error instanceof Error ? error.message : 'Unknown local test data load failure.');
            return false;
        }
    }

    async function loadCachedCalculatorData(options: { silentMissing?: boolean } = {}) {
        if (equipOperationActive()) {
            return;
        }

        try {
            setStatus('loading');
            setMessage('Loading cached profile and checking local manifest cache...');
            setLoadProgress({
                active: true,
                label: 'Reading cached profile',
                current: 0,
                total: 0,
                percent: 5
            });
            const cachedSnapshot = await readCachedVaultSnapshot();

            if (!cachedSnapshot) {
                setStatus(options.silentMissing ? 'idle' : 'error');
                setLoadProgress({ active: false, label: '', current: 0, total: 0, percent: 0 });
                setMessage(
                    options.silentMissing
                        ? 'No cached profile found. Sign in and refresh once.'
                        : 'No cached profile found yet. Refresh from Bungie once first.'
                );
                return;
            }

            await applyLoadedCalculatorData(cachedSnapshot as VaultExportSnapshot, 'cached profile');
        } catch (error) {
            setStatus('error');
            setLoadProgress({ active: false, label: '', current: 0, total: 0, percent: 0 });
            setMessage(error instanceof Error ? error.message : 'Unknown cached calculator load failure.');
        }
    }

    async function applyLoadedCalculatorData(
        nextSnapshot: VaultExportSnapshot,
        sourceLabel: string,
        options: { preserveSolve?: boolean } = {}
    ) {
        setLoadedSnapshot(null);
        setLoadedManifestDefinitions([]);
        if (!options.preserveSolve) {
            invalidateSolve();
        }

        const manifest = await createBungieManifestResolver({
            onStatus: (label) => {
                setLoadProgress({
                    active: true,
                    label,
                    current: 0,
                    total: 0,
                    percent: 10
                });
            }
        });
        const manifestMetadata = manifest.getManifestCacheMetadata?.();

        setLoadProgress({
            active: true,
            label: 'Preparing manifest resolver',
            current: 0,
            total: 0,
            percent: 12
        });
        const nextProfile = await normalizeVaultExport(nextSnapshot, manifest, {
            onProgress: (progress) => {
                const ratio = progress.total > 0 ? progress.current / progress.total : 0;
                setLoadProgress({
                    active: true,
                    label: progress.label,
                    current: progress.current,
                    total: progress.total,
                    percent: Math.max(12, Math.min(98, Math.round(12 + ratio * 86)))
                });
            }
        });
        const savedPreferences = readCalculatorPreferences();
        const desiredCharacterId = selectedCharacterId() || savedPreferences?.selectedCharacterId || '';
        const desiredExoticItemHash = selectedExoticItemHash() || savedPreferences?.selectedExoticItemHash || '';
        const selectedCharacter =
            nextProfile.characters.find((character) => character.characterId === desiredCharacterId) ?? nextProfile.characters[0];
        const nextCharacterId = selectedCharacter?.characterId ?? '';
        const nextCharacterClass = selectedCharacter?.classType ?? 'any';

        setNormalizedProfile(nextProfile);
        setLoadedSnapshot(nextSnapshot);
        setLoadedManifestDefinitions(manifest.getLoadedInventoryItemDefinitions());
        setSelectedCharacterId(nextCharacterId);
        setSelectedExoticItemHash(reconcileSelectedExotic(nextProfile, nextCharacterClass, desiredExoticItemHash));
        setSetSelections(reconcileSetSelections(nextProfile, nextCharacterClass, setSelections()));
        setStatus('done');
        setLoadProgress({
            active: false,
            label: 'Done',
            current: nextProfile.armor.length,
            total: nextProfile.armor.length,
            percent: 100
        });
        setMessage(
            [
                `Loaded ${nextProfile.armor.length} current armor candidate pieces for ${nextProfile.characters.length} characters from ${sourceLabel}.`,
                `Manifest cache: ${manifestMetadata?.fullCacheAvailable ? 'ready' : 'partial'}${manifestMetadata?.version ? ` (${manifestMetadata.version})` : ''}.`,
                `Loaded manifest definitions used by this profile: ${manifest.getLoadedInventoryItemDefinitions().length}.`,
                `Warnings: ${nextProfile.warnings.length}`
            ].join('\n')
        );
    }

    function applyLoadedNormalizedCalculatorData(
        nextProfile: NormalizedArmorProfile,
        nextSnapshot: VaultExportSnapshot | null,
        nextManifestDefinitions: LoadedManifestDefinition[],
        sourceLabel: string,
        options: { preserveSolve?: boolean } = {}
    ) {
        setLoadedSnapshot(null);
        setLoadedManifestDefinitions([]);
        if (!options.preserveSolve) {
            invalidateSolve();
        }

        const savedPreferences = readCalculatorPreferences();
        const desiredCharacterId = selectedCharacterId() || savedPreferences?.selectedCharacterId || '';
        const desiredExoticItemHash = selectedExoticItemHash() || savedPreferences?.selectedExoticItemHash || '';
        const selectedCharacter =
            nextProfile.characters.find((character) => character.characterId === desiredCharacterId) ?? nextProfile.characters[0];
        const nextCharacterId = selectedCharacter?.characterId ?? '';
        const nextCharacterClass = selectedCharacter?.classType ?? 'any';

        setNormalizedProfile(nextProfile);
        setLoadedSnapshot(nextSnapshot);
        setLoadedManifestDefinitions(nextManifestDefinitions);
        setSelectedCharacterId(nextCharacterId);
        setSelectedExoticItemHash(reconcileSelectedExotic(nextProfile, nextCharacterClass, desiredExoticItemHash));
        setSetSelections(reconcileSetSelections(nextProfile, nextCharacterClass, setSelections()));
        setStatus('done');
        setLoadProgress({
            active: false,
            label: 'Done',
            current: nextProfile.armor.length,
            total: nextProfile.armor.length,
            percent: 100
        });
        setMessage(
            [
                `Loaded ${nextProfile.armor.length} current armor candidate pieces for ${nextProfile.characters.length} characters from ${sourceLabel}.`,
                `Loaded manifest definitions in test bundle: ${nextManifestDefinitions.length}.`,
                `Warnings: ${nextProfile.warnings.length}`
            ].join('\n')
        );
    }

    function createSolveInput(
        profile: NormalizedArmorProfile,
        character: NonNullable<ReturnType<typeof selectedCharacter>>
    ): SolveArmorInput {
        return {
            characterId: character.characterId,
            classType: character.classType,
            selectedExoticItemHash: selectedExoticItemHash() ? Number(selectedExoticItemHash()) : undefined,
            dumpStat: dumpStat() || undefined,
            allowBalancedTuning: effectiveAllowBalancedTuning(),
            statTargets: targets(),
            statBonuses: selectedFragmentBonuses(),
            setRequirements: selectedSetRequirements(),
            armor: makeArmorBySlotForClass(profile.armor, character.classType),
            maxResults: SOLVER_RESULT_POOL_LIMIT,
            stopWhenResultLimitReached: true
        };
    }

    function solveCurrentBuilds() {
        void runSolve();
    }

    async function runSolve() {
        const profile = calculatorProfile();
        const character = selectedCharacter();

        if (!profile || !character) {
            setStatus('error');
            setLoadProgress({ active: false, label: '', current: 0, total: 0, percent: 0 });
            setMessage('Load calculator data before solving.');
            return;
        }

        if (targetCapsPending() || targetCapCalculationActive()) {
            setMessage('Finish checking stat limits before solving.');
            return;
        }

        if (!targetsAreWithinCaps(targets(), targetCaps(), dumpStat(), effectiveAllowBalancedTuning())) {
            setTargets((current) => clampTargetsToCaps(current, targetCaps(), dumpStat(), effectiveAllowBalancedTuning()));
            invalidateSolve();
            return;
        }

        const requestId = solveRequestId + 1;
        solveRequestId = requestId;
        const startedAt = performance.now();
        const solveInput = createSolveInput(profile, character);
        logDevTiming('solve started', {
            requestId,
            targets: targets(),
            caps: targetCaps(),
            setRequirements: selectedSetRequirements().length,
            armorCounts: armorSlotCounts(solveInput)
        });
        setStatus('solving');
        setLoadProgress({
            active: true,
            label: 'Solving builds',
            current: 0,
            total: 0,
            percent: 45
        });
        let result: SolveArmorResult;
        try {
            result = await armorSolver.solve(solveInput);
        } catch (error) {
            if (requestId !== solveRequestId) {
                logDevTiming('solve failed stale', {
                    requestId,
                    currentRequestId: solveRequestId,
                    ms: elapsedMs(startedAt)
                });
                return;
            }

            setStatus('error');
            setLoadProgress({ active: false, label: '', current: 0, total: 0, percent: 0 });
            setMessage(error instanceof Error ? error.message : 'Unknown armor solver worker failure.');
            logDevTiming('solve failed', {
                requestId,
                ms: elapsedMs(startedAt),
                error: error instanceof Error ? error.message : String(error)
            });
            return;
        }

        if (requestId !== solveRequestId) {
            logDevTiming('solve completed stale', {
                requestId,
                currentRequestId: solveRequestId,
                ms: elapsedMs(startedAt)
            });
            return;
        }

        setSolveResult(result);
        setStatus(result.ok ? 'done' : 'error');
        setLoadProgress({ active: false, label: '', current: 0, total: 0, percent: 0 });
        setMessage(
            result.ok
                ? [
                      `Found ${result.validBuildCount} builds. Retained ${result.returnedBuildCount}. Showing ${Math.min(VISIBLE_RESULT_LIMIT, result.returnedBuildCount)}.`,
                      result.resultLimitReached
                          ? 'Result pool hit the retained build cap; table sorting applies to retained builds.'
                          : null,
                      `Searched ${result.searchedCombinations} armor combinations.`
                  ]
                      .filter(Boolean)
                      .join(' ')
                : `${result.reason}\nSearched ${result.searchedCombinations} armor combinations.`
        );
        logDevTiming('solve completed', {
            requestId,
            ms: elapsedMs(startedAt),
            ok: result.ok,
            validBuildCount: result.ok ? result.validBuildCount : 0,
            returnedBuildCount: result.ok ? result.returnedBuildCount : 0,
            searchedCombinations: result.searchedCombinations
        });
    }

    async function importFragmentsFromGame() {
        if (equipOperationActive()) {
            setMessage('Finish applying the current build before importing fragments.');
            return;
        }

        try {
            setStatus('loading');
            setMessage('Importing equipped subclass fragments from Bungie...');
            setLoadProgress({
                active: true,
                label: 'Importing equipped subclass',
                current: 0,
                total: 0,
                percent: 35
            });

            const token = await getValidToken();
            const freshSnapshot = token ? ((await exportVaultSnapshot(token)) as VaultExportSnapshot) : loadedSnapshot();
            if (token) {
                setAuthenticated(true);
            }

            if (!freshSnapshot) {
                setStatus(normalizedProfile() ? 'done' : 'idle');
                setLoadProgress({ active: false, label: '', current: 0, total: 0, percent: 0 });
                setMessage('No loaded profile is available to import fragments from.');
                return;
            }

            const manifest = await createBungieManifestResolver();
            const imported = await readEquippedSubclassImport(freshSnapshot, selectedCharacterId(), loadedManifestDefinitions(), (hash) =>
                manifest.getInventoryItem(hash)
            );

            if (!imported) {
                setStatus(normalizedProfile() ? 'done' : 'idle');
                setLoadProgress({ active: false, label: '', current: 0, total: 0, percent: 0 });
                setMessage('Could not read an equipped subclass for the selected character.');
                return;
            }

            setLoadedSnapshot(freshSnapshot);
            setSelectedSubclass(imported.subclass);
            setSelectedFragmentIds(sanitizeFragmentIds(imported.fragmentIds, imported.subclass));
            setTargetCapPriorityStat(null);
            invalidateSolve();
            setStatus('done');
            setLoadProgress({ active: false, label: '', current: 0, total: 0, percent: 0 });
            setMessage(
                [
                    `Imported ${imported.subclassItemName}: ${imported.fragmentIds.length} known fragments selected.`,
                    imported.missingFragmentPlugHashes.length > 0
                        ? `Ignored ${imported.missingFragmentPlugHashes.length} fragment plug(s) that are not in rose yet.`
                        : null
                ]
                    .filter(Boolean)
                    .join(' ')
            );
        } catch (error) {
            setStatus('error');
            setLoadProgress({ active: false, label: '', current: 0, total: 0, percent: 0 });
            setMessage(error instanceof Error ? error.message : 'Unknown equipped subclass import failure.');
        }
    }

    async function equipBuildItems(build: ArmorBuild) {
        if (equipOperationActive()) {
            throw new Error('A build is already being applied.');
        }

        const token = await getValidToken();
        const snapshot = loadedSnapshot();
        const character = selectedCharacter();
        const membershipType = readSnapshotMembershipType(snapshot);
        let currentEquipSlot: ArmorSlot | undefined;

        if (!token) {
            throw new Error('Sign in again before equipping items.');
        }

        if (!snapshot || !character || membershipType === null) {
            throw new Error('Load a Bungie profile before equipping items.');
        }

        setEquipProgress(createInitialEquipProgress(build));
        setEquipOperationActive(true);

        let itemIds: string[] = [];

        try {
            await preserveSolveDuring(async () => {
                const resolvedItems = Object.fromEntries(
                    ARMOR_SLOTS.map((slot) => {
                        const piece = build.pieces[slot].item;
                        const resolved = resolveMovableBuildItem(snapshot, piece, character.characterId);
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
                itemIds = ARMOR_SLOTS.map((slot) => resolvedItemIds[slot]);
                console.debug('[rose bungie api] Equip build started', {
                    characterId: character.characterId,
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
                    currentEquipSlot = slot;
                    const piece = resolvedBuild.pieces[slot].item;
                    const location = resolvedItems[slot].location;

                    if (location.location === 'selected-character') {
                        continue;
                    }

                    if (location.location === 'other-character-equipped') {
                        updateEquipProgress({
                            slot,
                            status: 'failed',
                            detail: `${piece.name} is equipped on another character`
                        });
                        throw new Error(
                            `${piece.name} is equipped on another character. Move or unequip it first, then refresh rose and try again.`
                        );
                    }

                    if (location.location === 'other-character') {
                        updateEquipProgress({
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

                    updateEquipProgress({
                        slot,
                        status: 'active',
                        detail: `Moving ${piece.name} onto selected character`
                    });
                    console.debug('[rose bungie api] Moving item from vault to selected character', {
                        itemName: piece.name,
                        itemId: piece.itemInstanceId,
                        characterId: character.characterId
                    });
                    await transferDestinyItem(token, {
                        itemReferenceHash: piece.itemHash,
                        stackSize: 1,
                        transferToVault: false,
                        itemId: piece.itemInstanceId,
                        characterId: character.characterId,
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
                const socketDefinitions = [
                    ...loadedManifestDefinitions(),
                    ...itemSocketDefinitions,
                    ...(manifest.getInventoryItemDefinitionsByPlugCategory?.(GENERAL_ARMOR_MOD_PLUG_CATEGORY) ?? []),
                    ...(manifest.getInventoryItemDefinitionsByPlugCategory?.(TUNING_PLUG_CATEGORY) ?? [])
                ];
                const dedupedSocketDefinitions = [...createDefinitionMap(socketDefinitions)].map(([hash, definition]) => ({
                    hash,
                    definition
                }));
                await insertBuildSocketPlugs(
                    token,
                    snapshot,
                    membershipType,
                    character.characterId,
                    resolvedBuild,
                    dedupedSocketDefinitions,
                    (update) => updateEquipProgress(update)
                );

                currentEquipSlot = undefined;
                setEquipProgress((current) =>
                    current
                        ? {
                              ...current,
                              detail: 'Equipping all armor pieces',
                              pieces: current.pieces.map((piece) => ({
                                  ...piece,
                                  status: piece.status === 'failed' ? 'failed' : 'active',
                                  detail: 'Equipping'
                              }))
                          }
                        : current
                );
                await equipDestinyItems(token, {
                    itemIds,
                    characterId: character.characterId,
                    membershipType
                });

                console.debug('[rose bungie api] Equip build completed', {
                    characterId: character.characterId,
                    itemIds
                });
                setEquipProgress((current) =>
                    current
                        ? {
                              ...current,
                              detail: 'Build applied',
                              canDismiss: true,
                              pieces: current.pieces.map((piece) => ({
                                  ...piece,
                                  status: 'done',
                                  detail: 'Done'
                              }))
                          }
                        : current
                );
                dismissCompletedEquipProgress();
                setMessage('Equipped build. Refreshing profile...');
                const nextSnapshot = (await exportVaultSnapshot(token)) as VaultExportSnapshot;
                await applyLoadedCalculatorData(nextSnapshot, 'Bungie refresh', { preserveSolve: true });
            });
        } catch (error) {
            finishEquipProgress(error instanceof Error ? error.message : 'Unknown equip failure.', currentEquipSlot);
            console.error('[rose bungie api] Equip build failed', {
                characterId: character.characterId,
                membershipType,
                itemIds,
                error
            });
            setMessage(error instanceof Error ? error.message : 'Unknown equip failure.');
            throw error;
        } finally {
            setEquipOperationActive(false);
        }
    }

    function updateTarget(stat: ArmorStat, value: string) {
        const cap = dumpStat() === stat ? 0 : clampTarget(targetCaps()[stat]);
        const numericValue = snapStatTarget(Number(value) || 0, cap, effectiveAllowBalancedTuning());

        setTargetCapPriorityStat(stat);
        setTargets((current) => ({
            ...current,
            [stat]: numericValue
        }));
        invalidateSolve();
    }

    function updateSubclass(value: SubclassType) {
        const nextSubclass = sanitizeSubclassType(value);
        setSelectedSubclass(nextSubclass);
        setSelectedFragmentIds((current) => sanitizeFragmentIds(current, nextSubclass));
        setTargetCapPriorityStat(null);
        invalidateSolve();
    }

    function toggleFragment(fragmentId: string) {
        setSelectedFragmentIds((current) => {
            const selected = new Set(current);
            if (selected.has(fragmentId)) {
                selected.delete(fragmentId);
            } else {
                selected.add(fragmentId);
            }

            return sanitizeFragmentIds([...selected], selectedSubclass());
        });
        setTargetCapPriorityStat(null);
        invalidateSolve();
    }

    function updateDumpStat(value: string) {
        const nextDumpStat = isArmorStat(value) ? value : '';
        setDumpStat(nextDumpStat);
        invalidateSolve();

        if (!nextDumpStat) {
            setAllowBalancedTuning(false);
        }

        if (nextDumpStat) {
            setTargets((current) =>
                clampTargetsToCaps({ ...current, [nextDumpStat]: 0 }, targetCaps(), nextDumpStat, effectiveAllowBalancedTuning())
            );
        }
    }

    function updateSetRequirement(setId: string, value: string) {
        setSetSelections((current) => applySetSelectionLimit(current, setId, value === '2' || value === '4' ? value : '0'));
        invalidateSolve();
    }

    function applyCalculatorPreferences(preferences: CalculatorPreferences | null) {
        if (!preferences) {
            return;
        }

        const nextDumpStat = preferences.dumpStat && isArmorStat(preferences.dumpStat) ? preferences.dumpStat : '';
        const nextSubclass = sanitizeSubclassType(preferences.selectedSubclass);
        const nextAllowBalancedTuning = BALANCED_TUNING_ENABLED && preferences.allowBalancedTuning === true;
        const nextTargets = { ...EMPTY_STAT_TARGETS, ...sanitizeTargets(preferences.targets) };
        for (const stat of ARMOR_STATS) {
            nextTargets[stat] = snapStatTarget(nextTargets[stat], MAX_STAT_TARGET_CAPS[stat], nextAllowBalancedTuning);
        }
        if (nextDumpStat) {
            nextTargets[nextDumpStat] = 0;
        }

        setSelectedCharacterId(preferences.selectedCharacterId ?? '');
        setSelectedExoticItemHash(preferences.selectedExoticItemHash ?? '');
        setArmorSetDisplayMode(sanitizeArmorSetDisplayMode(preferences.armorSetDisplayMode));
        setSelectedSubclass(nextSubclass);
        setSelectedFragmentIds(sanitizeFragmentIds(preferences.selectedFragmentIds, nextSubclass));
        setDumpStat(nextDumpStat);
        setAllowBalancedTuning(nextAllowBalancedTuning);
        setOnlyFullyMasterworkedGear(preferences.onlyFullyMasterworkedGear === true);
        setTargets(nextTargets);
        setSetSelections(preferences.setSelections ?? {});
        setResultSort(preferences.resultSort ?? DEFAULT_RESULT_SORT);
    }

    function clearSavedCalculatorChoices() {
        clearCalculatorPreferences();
        resetBuildChoices();
        invalidateSolve();
        setStatus('idle');
        setMessage('Calculator choices cleared.');
    }

    return (
        <>
            <ArmorAppShell
                locked={calculatorLocked()}
                toolbar={
                    <AppToolbar
                        authenticated={authenticated()}
                        avatarLabel={avatarLabel()}
                        avatarUrl={avatarUrl()}
                        loading={status() === 'loading'}
                        onSignIn={signIn}
                        onRefresh={loadCalculatorData}
                    />
                }
                controls={
                    <CalculatorControls
                        characterOptions={characterButtons()}
                        selectedCharacterId={selectedCharacter()?.characterId ?? ''}
                        selectedExoticItemHash={selectedExoticItemHash()}
                        armorSetDisplayMode={armorSetDisplayMode()}
                        selectedSubclass={selectedSubclass()}
                        selectedFragmentIds={selectedFragmentIds()}
                        dumpStat={dumpStat()}
                        allowBalancedTuning={effectiveAllowBalancedTuning()}
                        onlyFullyMasterworkedGear={onlyFullyMasterworkedGear()}
                        targets={targets()}
                        targetCaps={targetCaps()}
                        targetCapsPending={targetCapsPending()}
                        setSelections={setSelections()}
                        availableExotics={availableExotics()}
                        selectableSets={selectableSets()}
                        canSolve={
                            !calculatorLocked() &&
                            Boolean(normalizedProfile()) &&
                            status() !== 'loading' &&
                            status() !== 'solving' &&
                            !targetCapsPending() &&
                            !targetCapCalculationActive()
                        }
                        solving={status() === 'loading' || status() === 'solving'}
                        onCharacterSelect={selectCharacter}
                        onArmorSetDisplayModeChange={setArmorSetDisplayMode}
                        onSubclassChange={updateSubclass}
                        onFragmentToggle={toggleFragment}
                        onImportFragmentsFromGame={importFragmentsFromGame}
                        onExoticChange={(itemHash) => {
                            setSelectedExoticItemHash(itemHash);
                            invalidateSolve();
                        }}
                        onDumpStatChange={updateDumpStat}
                        onBalancedTuningChange={(enabled) => {
                            setAllowBalancedTuning(BALANCED_TUNING_ENABLED && enabled);
                            invalidateSolve();
                        }}
                        onOnlyFullyMasterworkedGearChange={(enabled) => {
                            setOnlyFullyMasterworkedGear(enabled);
                            invalidateSolve();
                        }}
                        onTargetChange={updateTarget}
                        onSetRequirementChange={updateSetRequirement}
                        onSolve={solveCurrentBuilds}
                        onClearChoices={clearSavedCalculatorChoices}
                    />
                }
                results={
                    <ResultsPanel
                        result={solveResult()}
                        builds={resultBuilds()}
                        armorSets={selectableSets()}
                        armorSetDisplayMode={armorSetDisplayMode()}
                        resultFailure={resultFailure()}
                        sort={resultSort()}
                        dumpStat={dumpStat()}
                        loading={status() === 'loading' || status() === 'solving'}
                        progress={loadProgress()}
                        showTuningResults={showTuningResults()}
                        visibleLimit={VISIBLE_RESULT_LIMIT}
                        expandedBuildKey={expandedBuildKey()}
                        onExpandedBuildKeyChange={setExpandedBuildKey}
                        onEquipBuild={equipBuildItems}
                        onSort={toggleResultSort}
                    />
                }
            />
            <EquipProgressOverlay progress={equipProgress()} onDismiss={() => setEquipProgress(null)} />
        </>
    );
}
