import {
    ARMOR_SLOTS,
    ARMOR_STATS,
    type ArmorInventoryBySlot,
    type ArmorItem,
    type ArmorSetInfo,
    type ArmorSlot,
    createDefaultStatModOptions,
    createTierFiveTuningOptions,
    type DestinyClass,
    dedupeEquivalentArmorItems,
    emptyStats,
    NO_TUNING,
    type StatAdjustment,
    type StatVector,
    subtractStats
} from '@armor-calc';

import { CLASS_BY_BUNGIE_CLASS_TYPE, CLASS_LABELS, STAT_BY_HASH } from '@/features/armor/stat-hashes';
import type {
    ArmorSetBonusInfo,
    ArmorSetCatalogEntry,
    DestinyProfileItem,
    ManifestEquipableItemSetDefinition,
    ManifestInventoryItemDefinition,
    ManifestResolver,
    NormalizedArmorProfile,
    NormalizeVaultExportOptions,
    VaultExportSnapshot
} from '@/features/armor/types';

const ARMOR_ITEM_TYPE = 2;
const EXOTIC_TIER_TYPE = 6;
const ARMOR_STATS_PLUG_CATEGORY = 'armor_stats';
const TUNING_PLUG_CATEGORY = 'core.gear_systems.armor_tiering.plugs.tuning.mods';
const MASTERWORK_PLUG_CATEGORY_PREFIX = 'v460.plugs.armor.masterworks';
const BUNGIE_ORIGIN = 'https://www.bungie.net';

const BUCKET_SLOT_BY_HASH: Record<number, ArmorSlot> = {
    3448274439: 'helmet',
    3551918588: 'arms',
    14239492: 'chest',
    20886954: 'legs',
    1585787867: 'classItem'
};

export async function normalizeVaultExport(
    snapshot: VaultExportSnapshot,
    manifest: ManifestResolver,
    options: NormalizeVaultExportOptions = {}
): Promise<NormalizedArmorProfile> {
    const profile = snapshot.profileResponse?.Response;
    const warnings: string[] = [];

    if (!profile) {
        return {
            characters: [],
            armor: [],
            armorBySlot: emptyArmorBySlot(),
            armorSetCatalog: [],
            warnings: ['No profile response found in vault export.']
        };
    }

    const characters = Object.entries(profile.characters?.data ?? {}).map(([characterId, character]) => {
        const classType = CLASS_BY_BUNGIE_CLASS_TYPE[character.classType] ?? 'any';
        return {
            characterId,
            classType,
            label: `${CLASS_LABELS[classType]} ${character.light ?? ''}`.trim(),
            light: character.light
        };
    });

    const profileItems = collectProfileItems(snapshot).filter(
        (item) => item.itemInstanceId && hasArmorStatComponent(profile, item.itemInstanceId)
    );
    const armor: ArmorItem[] = [];

    options.onProgress?.({
        label: 'Resolving armor manifest definitions',
        current: 0,
        total: profileItems.length
    });

    for (const [index, item] of profileItems.entries()) {
        const definition = await manifest.getInventoryItem(item.itemHash);
        const normalized = await normalizeArmorItem(item, definition, snapshot, manifest, warnings);

        if (normalized) {
            armor.push(normalized);
        }

        options.onProgress?.({
            label: 'Resolving armor manifest definitions',
            current: index + 1,
            total: profileItems.length
        });
    }

    const dedupedArmor = applyArmorSetNames(dedupeEquivalentArmorItems(armor));

    return {
        characters,
        armor: dedupedArmor,
        armorBySlot: groupArmorBySlot(dedupedArmor),
        armorSetCatalog: await buildArmorSetCatalog(manifest, dedupedArmor),
        warnings
    };
}

export function collectProfileItems(snapshot: VaultExportSnapshot): DestinyProfileItem[] {
    const profile = snapshot.profileResponse?.Response;
    if (!profile) {
        return [];
    }

    const inventoryItems = profile.profileInventory?.data?.items ?? [];
    const characterInventoryItems = Object.values(profile.characterInventories?.data ?? {}).flatMap((bucket) => bucket.items ?? []);
    const equippedItems = Object.values(profile.characterEquipment?.data ?? {}).flatMap((bucket) => bucket.items ?? []);
    const byInstanceId = new Map<string, DestinyProfileItem>();

    for (const item of [...inventoryItems, ...characterInventoryItems, ...equippedItems]) {
        if (item.itemInstanceId) {
            byInstanceId.set(item.itemInstanceId, item);
        }
    }

    return [...byInstanceId.values()];
}

function hasArmorStatComponent(profile: NonNullable<VaultExportSnapshot['profileResponse']>['Response'], itemInstanceId?: string) {
    if (!itemInstanceId) {
        return false;
    }

    const stats = profile?.itemComponents?.stats?.data?.[itemInstanceId]?.stats ?? {};
    return Object.keys(stats).some((statHash) => STAT_BY_HASH[statHash]);
}

async function normalizeArmorItem(
    item: DestinyProfileItem,
    definition: ManifestInventoryItemDefinition | null,
    snapshot: VaultExportSnapshot,
    manifest: ManifestResolver,
    warnings: string[]
): Promise<ArmorItem | null> {
    if (!definition) {
        warnings.push(`Missing manifest definition for item ${item.itemHash}.`);
        return null;
    }

    if (definition.itemType !== ARMOR_ITEM_TYPE) {
        return null;
    }

    const slot = getArmorSlot(definition);
    if (!slot) {
        return null;
    }

    const itemInstanceId = item.itemInstanceId;
    if (!itemInstanceId) {
        return null;
    }

    const profile = snapshot.profileResponse?.Response;
    const sockets = profile?.itemComponents?.sockets?.data?.[itemInstanceId]?.sockets ?? [];
    const gearTier = readGearTier(profile, itemInstanceId);
    if (gearTier !== undefined && gearTier !== 5) {
        return null;
    }

    const hasCurrentArmorStats = await hasSocketPlugCategory(sockets, manifest, ARMOR_STATS_PLUG_CATEGORY);

    if (!hasCurrentArmorStats) {
        return null;
    }

    const hasTuningSocket = await hasSocketPlugCategory(sockets, manifest, TUNING_PLUG_CATEGORY);
    const baseStats = readItemStats(profile?.itemComponents?.stats?.data?.[itemInstanceId]?.stats ?? {});
    const socketAdjustments = await readSocketedStatAdjustments(sockets, manifest);
    const statsWithoutChosenPlugs = socketAdjustments.reduce((stats, adjustment) => subtractStats(stats, adjustment.deltas), baseStats);
    const currentMasterwork = await readSocketedMasterworkAdjustment(sockets, manifest);
    const normalizedBaseStats = currentMasterwork
        ? subtractStats(statsWithoutChosenPlugs, currentMasterwork.deltas)
        : statsWithoutChosenPlugs;
    if (!hasModernArmorStatShape(normalizedBaseStats)) {
        return null;
    }

    const tier = gearTier ?? (hasTuningSocket ? 5 : inferArmorTier(definition));
    const set = inferArmorSet(definition, definition.displayProperties?.name);
    const statModOptions = createDefaultStatModOptions();
    const normalizedItem: ArmorItem = {
        itemInstanceId,
        itemHash: item.itemHash,
        name: definition.displayProperties?.name || `Item ${item.itemHash}`,
        iconUrl: absoluteBungieAssetUrl(definition.displayProperties?.icon),
        slot,
        classType: normalizeClass(definition.classType),
        isExotic: definition.inventory?.tierType === EXOTIC_TIER_TYPE || definition.inventory?.tierTypeName === 'Exotic',
        set,
        tier,
        baseStats: normalizedBaseStats,
        statModOptions,
        tuningOptions: await readTuningOptions(itemInstanceId, sockets, profile, manifest, normalizedBaseStats, hasTuningSocket),
        debugWarnings: []
    };

    if (!set) {
        normalizedItem.debugWarnings?.push('No armor set metadata inferred.');
    }

    if (!tier) {
        normalizedItem.debugWarnings?.push('No armor tier metadata inferred.');
    }

    return normalizedItem;
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

async function buildArmorSetCatalog(manifest: ManifestResolver, ownedArmor: ArmorItem[]): Promise<ArmorSetCatalogEntry[]> {
    const setDefinitions = manifest.getEquipableItemSetDefinitions?.() ?? [];
    if (setDefinitions.length === 0) {
        return [];
    }

    const ownedNamesBySetId = new Map<string, string>();
    for (const item of ownedArmor) {
        if (item.set) {
            ownedNamesBySetId.set(item.set.id, item.set.name);
        }
    }

    const catalog: ArmorSetCatalogEntry[] = [];
    for (const { hash, definition } of setDefinitions) {
        if (definition.redacted) {
            continue;
        }

        const setHash = definition.hash ?? hash;
        if (!Number.isFinite(setHash)) {
            continue;
        }

        const itemHashes = [...new Set(definition.setItems ?? [])].filter(Number.isFinite);
        const itemDefinitions = await Promise.all(itemHashes.map((itemHash) => manifest.getInventoryItem(itemHash)));
        const armorDefinitions = itemDefinitions
            .map((itemDefinition, index) => ({
                itemHash: itemHashes[index],
                definition: itemDefinition,
                slot: itemDefinition ? getArmorSlot(itemDefinition) : null
            }))
            .filter(
                (
                    item
                ): item is {
                    itemHash: number;
                    definition: ManifestInventoryItemDefinition;
                    slot: ArmorSlot;
                } => item.definition?.itemType === ARMOR_ITEM_TYPE && item.slot !== null
            );

        if (armorDefinitions.length === 0) {
            continue;
        }

        const id = `equipable:${setHash}`;
        const name =
            definition.displayProperties?.name ||
            ownedNamesBySetId.get(id) ||
            deriveArmorSetNameFromNames(armorDefinitions.map((item) => item.definition.displayProperties?.name ?? '')) ||
            `Armor Set ${setHash}`;
        const classTypes = uniqueArmorClasses(armorDefinitions.map((item) => normalizeClass(item.definition.classType)));
        const slots = uniqueArmorSlots(armorDefinitions.map((item) => item.slot));
        const bonuses = await readArmorSetBonuses(definition, manifest);

        catalog.push({
            id,
            name,
            equipableItemSetHash: setHash,
            iconUrl: absoluteBungieAssetUrl(definition.displayProperties?.icon),
            itemHashes,
            classTypes,
            slots,
            bonuses
        });
    }

    return catalog.sort((left, right) => left.name.localeCompare(right.name));
}

async function readArmorSetBonuses(definition: ManifestEquipableItemSetDefinition, manifest: ManifestResolver) {
    const bonuses: ArmorSetBonusInfo[] = [];

    for (const setPerk of definition.setPerks ?? []) {
        const requiredPieces = setPerk.requiredSetCount;
        if (!requiredPieces || requiredPieces < 1) {
            continue;
        }

        const perk = setPerk.sandboxPerkHash ? await manifest.getSandboxPerk?.(setPerk.sandboxPerkHash) : null;
        const fallbackName = `${requiredPieces}-piece bonus`;

        bonuses.push({
            requiredPieces,
            sandboxPerkHash: setPerk.sandboxPerkHash,
            name: perk?.displayProperties?.name || fallbackName,
            description: perk?.displayProperties?.description,
            iconUrl: absoluteBungieAssetUrl(perk?.displayProperties?.icon)
        });
    }

    return bonuses.sort((left, right) => left.requiredPieces - right.requiredPieces || left.name.localeCompare(right.name));
}

function uniqueArmorClasses(classTypes: DestinyClass[]) {
    return [...new Set(classTypes)].sort((left, right) => left.localeCompare(right));
}

function uniqueArmorSlots(slots: ArmorSlot[]) {
    return ARMOR_SLOTS.filter((slot) => slots.includes(slot));
}

function readItemStats(stats: Record<string, { value?: number }>): StatVector {
    const normalized = emptyStats();

    for (const [statHash, statValue] of Object.entries(stats)) {
        const stat = STAT_BY_HASH[statHash];
        if (stat) {
            normalized[stat] = statValue.value ?? 0;
        }
    }

    return normalized;
}

function readGearTier(profile: NonNullable<VaultExportSnapshot['profileResponse']>['Response'] | undefined, itemInstanceId: string) {
    const gearTier = profile?.itemComponents?.instances?.data?.[itemInstanceId]?.gearTier;
    return gearTier === 1 || gearTier === 2 || gearTier === 3 || gearTier === 4 || gearTier === 5 ? gearTier : undefined;
}

function hasModernArmorStatShape(stats: StatVector) {
    return ARMOR_STATS.every((stat) => stats[stat] % 5 === 0);
}

async function readSocketedStatAdjustments(sockets: Array<{ plugHash?: number }>, manifest: ManifestResolver) {
    const adjustments: StatAdjustment[] = [];

    for (const socket of sockets) {
        if (!socket.plugHash) {
            continue;
        }

        const definition = await manifest.getInventoryItem(socket.plugHash);
        const adjustment = definition ? statAdjustmentFromDefinition(definition) : null;

        if (adjustment) {
            adjustments.push(adjustment);
        }
    }

    return adjustments;
}

async function readSocketedMasterworkAdjustment(sockets: Array<{ plugHash?: number }>, manifest: ManifestResolver) {
    return sumAdjustments(await readMasterworkAdjustmentsFromSockets(sockets, manifest));
}

async function readMasterworkAdjustmentsFromSockets(sockets: Array<{ plugHash?: number }>, manifest: ManifestResolver) {
    const adjustments: StatAdjustment[] = [];

    for (const socket of sockets) {
        if (!socket.plugHash) {
            continue;
        }

        const definition = await manifest.getInventoryItem(socket.plugHash);
        const adjustment = definition ? masterworkAdjustmentFromDefinition(definition) : null;

        if (adjustment) {
            adjustments.push(adjustment);
        }
    }

    return adjustments;
}

async function readTuningOptions(
    itemInstanceId: string,
    sockets: Array<{ plugHash?: number }>,
    profile: NonNullable<VaultExportSnapshot['profileResponse']>['Response'] | undefined,
    manifest: ManifestResolver,
    baseStats: StatVector,
    hasTuningSocket: boolean
) {
    if (!hasTuningSocket) {
        return [NO_TUNING];
    }

    const tuningSocketIndexes = await socketIndexesForPlugCategory(sockets, manifest, TUNING_PLUG_CATEGORY);
    const reusablePlugs = profile?.itemComponents?.reusablePlugs?.data?.[itemInstanceId]?.plugs ?? {};
    const options = new Map<string, StatAdjustment>();
    options.set(NO_TUNING.id, NO_TUNING);

    for (const socketIndex of tuningSocketIndexes) {
        for (const plug of reusablePlugs[String(socketIndex)] ?? []) {
            if (!plug.plugItemHash || plug.canInsert === false || plug.enabled === false) {
                continue;
            }

            const definition = await manifest.getInventoryItem(plug.plugItemHash);
            const adjustment = definition ? statAdjustmentFromDefinition(definition) : null;

            if (adjustment && !isZeroAdjustment(adjustment)) {
                options.set(adjustment.id, adjustment);
            }
        }
    }

    if (options.size > 1) {
        return [...options.values()];
    }

    return createTierFiveTuningOptions({ baseStats, tier: 5 });
}

async function hasSocketPlugCategory(sockets: Array<{ plugHash?: number }>, manifest: ManifestResolver, category: string) {
    return (await socketIndexesForPlugCategory(sockets, manifest, category)).length > 0;
}

async function socketIndexesForPlugCategory(sockets: Array<{ plugHash?: number }>, manifest: ManifestResolver, category: string) {
    return socketIndexesMatchingPlugCategory(sockets, manifest, (plugCategory) => plugCategory === category);
}

async function socketIndexesMatchingPlugCategory(
    sockets: Array<{ plugHash?: number }>,
    manifest: ManifestResolver,
    matchesCategory: (plugCategory: string) => boolean
) {
    const indexes: number[] = [];

    for (const [index, socket] of sockets.entries()) {
        if (!socket.plugHash) {
            continue;
        }

        const definition = await manifest.getInventoryItem(socket.plugHash);
        if (definition?.plug?.plugCategoryIdentifier && matchesCategory(definition.plug.plugCategoryIdentifier)) {
            indexes.push(index);
        }
    }

    return indexes;
}

function statAdjustmentFromDefinition(definition: ManifestInventoryItemDefinition): StatAdjustment | null {
    const name = definition.displayProperties?.name ?? `Plug ${definition.hash ?? 'unknown'}`;
    const plugCategory = definition.plug?.plugCategoryIdentifier ?? '';
    if (plugCategory === ARMOR_STATS_PLUG_CATEGORY || plugCategory.startsWith(MASTERWORK_PLUG_CATEGORY_PREFIX)) {
        return null;
    }

    const searchable = `${name} ${definition.displayProperties?.description ?? ''} ${plugCategory}`.toLowerCase();
    const isLikelyStatPlug = searchable.includes('mod') || searchable.includes('tuning') || searchable.includes('stat');

    if (!isLikelyStatPlug) {
        return null;
    }

    return statAdjustmentFromInvestmentStats(definition, name);
}

function masterworkAdjustmentFromDefinition(definition: ManifestInventoryItemDefinition): StatAdjustment | null {
    const plugCategory = definition.plug?.plugCategoryIdentifier ?? '';
    if (!plugCategory.startsWith(MASTERWORK_PLUG_CATEGORY_PREFIX)) {
        return null;
    }

    const name = definition.displayProperties?.name ?? `Masterwork ${definition.hash ?? 'unknown'}`;
    return statAdjustmentFromInvestmentStats(definition, name);
}

function statAdjustmentFromInvestmentStats(definition: ManifestInventoryItemDefinition, name: string): StatAdjustment | null {
    const deltas = emptyStats();
    let hasDelta = false;

    for (const investmentStat of definition.investmentStats ?? []) {
        const stat = STAT_BY_HASH[String(investmentStat.statTypeHash)];
        if (!stat || Math.abs(investmentStat.value) > 20) {
            continue;
        }

        deltas[stat] += investmentStat.value;
        hasDelta = true;
    }

    return hasDelta
        ? {
              id: `plug:${definition.hash ?? name}`,
              name,
              deltas
          }
        : null;
}

function sumAdjustments(adjustments: StatAdjustment[]) {
    if (adjustments.length === 0) {
        return null;
    }

    return {
        id: adjustments.map((adjustment) => adjustment.id).join('+'),
        name: adjustments.map((adjustment) => adjustment.name).join(' + '),
        deltas: adjustments.reduce((total, adjustment) => addStatsLocal(total, adjustment.deltas), emptyStats())
    } satisfies StatAdjustment;
}

function addStatsLocal(left: StatVector, right: Partial<StatVector>) {
    const next = emptyStats();

    for (const stat of ARMOR_STATS) {
        next[stat] = left[stat] + (right[stat] ?? 0);
    }

    return next;
}

function isZeroAdjustment(adjustment: StatAdjustment) {
    return ARMOR_STATS.every((stat) => (adjustment.deltas[stat] ?? 0) === 0);
}

function getArmorSlot(definition: ManifestInventoryItemDefinition): ArmorSlot | null {
    const bucketHash = definition.inventory?.bucketTypeHash;
    return bucketHash ? (BUCKET_SLOT_BY_HASH[bucketHash] ?? null) : null;
}

function normalizeClass(classType?: number): DestinyClass {
    return classType === undefined ? 'any' : (CLASS_BY_BUNGIE_CLASS_TYPE[classType] ?? 'any');
}

function inferArmorTier(definition: ManifestInventoryItemDefinition): 1 | 2 | 3 | 4 | 5 | undefined {
    const text = stringifyDefinitionSearchText(definition);
    const match = text.match(/\b(?:tier|t)\s*([1-5])\b/i);
    const tier = match?.[1] ? Number(match[1]) : undefined;

    return tier === 1 || tier === 2 || tier === 3 || tier === 4 || tier === 5 ? tier : undefined;
}

function inferArmorSet(definition: ManifestInventoryItemDefinition, fallbackName?: string): ArmorSetInfo | undefined {
    const setHash = definition.equippingBlock?.equipableItemSetHash;

    if (!Number.isFinite(setHash)) {
        return undefined;
    }

    return {
        id: `equipable:${setHash}`,
        name: fallbackName || `Armor Set ${setHash}`,
        equipableItemSetHash: setHash
    };
}

function stringifyDefinitionSearchText(definition: ManifestInventoryItemDefinition) {
    const textParts = [
        definition.displayProperties?.name,
        definition.displayProperties?.description,
        definition.inventory?.tierTypeName,
        ...(definition.perks ?? []).map((perk) => perk.requirementDisplayString)
    ];

    return textParts.filter(Boolean).join(' ');
}

function applyArmorSetNames(armor: ArmorItem[]) {
    const grouped = new Map<string, ArmorItem[]>();

    for (const item of armor) {
        if (!item.set) {
            continue;
        }

        grouped.set(item.set.id, [...(grouped.get(item.set.id) ?? []), item]);
    }

    const names = new Map<string, string>();
    for (const [setId, items] of grouped.entries()) {
        names.set(setId, deriveArmorSetName(items) ?? items[0]?.set?.name ?? setId);
    }

    return armor.map((item) => {
        if (!item.set) {
            return item;
        }

        return {
            ...item,
            set: {
                ...item.set,
                name: names.get(item.set.id) ?? item.set.name
            }
        };
    });
}

function deriveArmorSetName(items: ArmorItem[]) {
    return deriveArmorSetNameFromNames(items.map((item) => item.name));
}

function deriveArmorSetNameFromNames(names: string[]) {
    const tokenizedNames = names.map((name) => tokenizeArmorName(name)).filter((tokens) => tokens.length > 0);
    const first = tokenizedNames[0];

    if (!first) {
        return undefined;
    }

    let commonLength = first.length;
    for (const tokens of tokenizedNames.slice(1)) {
        commonLength = Math.min(commonLength, commonPrefixLength(first, tokens));
    }

    return commonLength > 0
        ? first
              .slice(0, commonLength)
              .map((token) => token.original)
              .join(' ')
        : undefined;
}

function tokenizeArmorName(name: string) {
    return name
        .replace(/[^\w' -]+/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((token) => ({
            original: token,
            normalized: token.toLowerCase().replace(/[^a-z0-9]+/g, '')
        }))
        .filter((token) => token.normalized.length > 0);
}

function commonPrefixLength(left: Array<{ normalized: string }>, right: Array<{ normalized: string }>) {
    let index = 0;
    while (left[index] && right[index] && left[index].normalized === right[index].normalized) {
        index += 1;
    }

    return index;
}

function emptyArmorBySlot(): ArmorInventoryBySlot {
    return {
        helmet: [],
        arms: [],
        chest: [],
        legs: [],
        classItem: []
    };
}

export function groupArmorBySlot(armor: ArmorItem[]): ArmorInventoryBySlot {
    const grouped = emptyArmorBySlot();

    for (const item of armor) {
        grouped[item.slot].push(item);
    }

    for (const slot of ARMOR_SLOTS) {
        grouped[slot].sort((left, right) => right.baseStats.health - left.baseStats.health || left.name.localeCompare(right.name));
    }

    return grouped;
}

export function getArmorForClass(armor: ArmorItem[], classType: DestinyClass) {
    return armor.filter((item) => item.classType === 'any' || item.classType === classType);
}

export function getAvailableArmorSets(armor: ArmorItem[], classType: DestinyClass) {
    const counts = new Map<string, { id: string; name: string; count: number; slotCounts: Record<ArmorSlot, number> }>();

    for (const item of getArmorForClass(armor, classType)) {
        if (!item.set) {
            continue;
        }

        const current = counts.get(item.set.id);
        const slotCounts = current?.slotCounts ?? {
            helmet: 0,
            arms: 0,
            chest: 0,
            legs: 0,
            classItem: 0
        };
        slotCounts[item.slot] += 1;

        counts.set(item.set.id, {
            id: item.set.id,
            name: item.set.name,
            count: (current?.count ?? 0) + 1,
            slotCounts
        });
    }

    return [...counts.values()].sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
}

export function makeArmorBySlotForClass(armor: ArmorItem[], classType: DestinyClass): ArmorInventoryBySlot {
    return groupArmorBySlot(getArmorForClass(armor, classType));
}

export function hasArmorStats(stats: StatVector) {
    return ARMOR_STATS.some((stat) => stats[stat] > 0);
}
