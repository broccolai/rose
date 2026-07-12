import type { ArmorBuild, StatVector } from '@armor-domain';
import type {
    DestinyInventoryItemDefinition,
    DestinyItemInstanceComponent,
    DestinyItemSocketsComponent,
    DestinyItemStatsComponent
} from 'bungie-api-ts/destiny2';

import { emptyStatVector, readInvestmentStats, statTotal, sumStats } from '@/features/armor/api/socket-plugs';
import { buildExpansionKey } from '@/features/armor/result-display';
import { STAT_BY_HASH } from '@/features/armor/stat-hashes';
import type { LoadedManifestDefinition, NormalizedArmorProfile, VaultExportSnapshot } from '@/features/armor/types';

const MASTERWORK_PLUG_CATEGORY_PREFIX = 'v460.plugs.armor.masterworks';

type DebugStatComponents = Record<string, DestinyItemStatsComponent>;
type DebugSocketComponents = Record<string, DestinyItemSocketsComponent>;
type DebugInstanceComponents = Record<string, DestinyItemInstanceComponent>;

export const createDebugArmorReport = (
    snapshot: VaultExportSnapshot | null,
    profile: NormalizedArmorProfile | null,
    definitions: LoadedManifestDefinition[]
) => {
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
                normalizedBaseTotal: statTotal(item.baseStats),
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
};

export const createDebugExpandedResultReport = (builds: ArmorBuild[], expandedBuildKey: string | null) => {
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
};

const createDebugArmorInstanceReport = (
    itemInstanceId: string,
    statComponents: DebugStatComponents,
    socketComponents: DebugSocketComponents,
    instanceComponents: DebugInstanceComponents,
    definitionByHash: Map<number, DestinyInventoryItemDefinition>
) => {
    const rawStats = readDebugStats(statComponents[itemInstanceId]?.stats ?? {});
    const sockets = socketComponents[itemInstanceId]?.sockets ?? [];
    const socketReports = sockets.map((socket, socketIndex) => createDebugSocketReport(socket.plugHash, socketIndex, definitionByHash));
    const masterworkSockets = socketReports.filter((socket) => socket.plugCategory?.startsWith(MASTERWORK_PLUG_CATEGORY_PREFIX));
    const currentMasterworkStats = sumStats(masterworkSockets.map((socket) => socket.deltas));

    return {
        itemInstanceId,
        gearTier: instanceComponents[itemInstanceId]?.gearTier,
        rawDisplayedStats: rawStats,
        rawDisplayedTotal: statTotal(rawStats),
        currentMasterwork: {
            detected: masterworkSockets.length > 0,
            plugCount: masterworkSockets.length,
            total: statTotal(currentMasterworkStats),
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
};

const createDebugSocketReport = (
    plugHash: number | undefined,
    socketIndex: number,
    definitionByHash: Map<number, DestinyInventoryItemDefinition>
) => {
    const definition = plugHash ? definitionByHash.get(plugHash) : undefined;

    return {
        socketIndex,
        plugHash,
        name: definition?.displayProperties?.name,
        description: definition?.displayProperties?.description,
        plugCategory: definition?.plug?.plugCategoryIdentifier,
        deltas: definition ? readInvestmentStats(definition) : emptyStatVector()
    };
};

const readDebugStats = (stats: DestinyItemStatsComponent['stats']): StatVector => {
    const normalized = emptyStatVector();

    for (const [statHash, statValue] of Object.entries(stats)) {
        const stat = STAT_BY_HASH[statHash];
        if (stat) {
            normalized[stat] = statValue.value ?? 0;
        }
    }

    return normalized;
};
