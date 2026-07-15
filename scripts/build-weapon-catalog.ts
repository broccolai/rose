import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type {
    DestinyCollectibleDefinition,
    DestinyInventoryItemDefinition,
    DestinyPlugSetDefinition,
    DestinySocketTypeDefinition,
    DestinyStatDefinition,
    DestinyStatGroupDefinition
} from 'bungie-api-ts/destiny2';

import type {
    WeaponAmmoType,
    WeaponCatalog,
    WeaponDefinition,
    WeaponElement,
    WeaponPlug,
    WeaponRarity,
    WeaponSlot,
    WeaponSocket
} from '../src/features/weapons/types';
import { isObservedWeaponMasterwork, isPlugAllowedBySocketType, masterworkFamilyKey, masterworkStatName } from './weapon-catalog-rules';

const MANIFEST_COMPONENTS = [
    'DestinyInventoryItemDefinition',
    'DestinyPlugSetDefinition',
    'DestinySocketTypeDefinition',
    'DestinyStatGroupDefinition',
    'DestinyCollectibleDefinition',
    'DestinyStatDefinition'
] as const;

const WEAPON_ITEM_TYPE = 3;
const KINETIC_SLOT_HASH = 1498876634;
const ENERGY_SLOT_HASH = 2465295065;
const POWER_SLOT_HASH = 953998645;
const root = join(import.meta.dir, '..');
const outputPath = join(root, 'public/data/weapon-catalog.json');

type ManifestIndex = {
    Response?: {
        version?: string;
        jsonWorldComponentContentPaths?: Record<string, Partial<Record<(typeof MANIFEST_COMPONENTS)[number], string>>>;
    };
    ErrorCode?: number;
    Message?: string;
};

type ManifestTables = {
    DestinyInventoryItemDefinition: Record<string, DestinyInventoryItemDefinition>;
    DestinyPlugSetDefinition: Record<string, DestinyPlugSetDefinition>;
    DestinySocketTypeDefinition: Record<string, DestinySocketTypeDefinition>;
    DestinyStatGroupDefinition: Record<string, DestinyStatGroupDefinition>;
    DestinyCollectibleDefinition: Record<string, DestinyCollectibleDefinition>;
    DestinyStatDefinition: Record<string, DestinyStatDefinition>;
};

const apiKey = Bun.env['VITE_BUNGIE_API_KEY'];
if (!apiKey) {
    throw new Error('VITE_BUNGIE_API_KEY is required to refresh the weapon catalog.');
}

const manifestResponse = await fetch('https://www.bungie.net/Platform/Destiny2/Manifest/', {
    headers: { 'X-API-Key': apiKey }
});
const manifest = (await manifestResponse.json()) as ManifestIndex;
if (!manifestResponse.ok || manifest.ErrorCode !== 1 || !manifest.Response) {
    throw new Error(manifest.Message || `Bungie manifest index failed (${manifestResponse.status}).`);
}

const englishPaths = manifest.Response.jsonWorldComponentContentPaths?.['en'];
if (!englishPaths) {
    throw new Error('Bungie manifest has no English component paths.');
}

const tables = Object.fromEntries(
    await Promise.all(
        MANIFEST_COMPONENTS.map(async (component) => {
            const path = englishPaths[component];
            if (!path) {
                throw new Error(`Bungie manifest is missing ${component}.`);
            }

            const response = await fetch(`https://www.bungie.net${path}`);
            if (!response.ok) {
                throw new Error(`${component} download failed (${response.status}).`);
            }

            return [component, await response.json()] as const;
        })
    )
) as ManifestTables;

const inventoryItems = tables.DestinyInventoryItemDefinition;
const plugSets = tables.DestinyPlugSetDefinition;
const socketTypes = tables.DestinySocketTypeDefinition;
const statGroups = tables.DestinyStatGroupDefinition;
const collectibles = tables.DestinyCollectibleDefinition;
const statDefinitions = tables.DestinyStatDefinition;
const observedMasterworkStats = collectObservedMasterworkStats();
const usedPlugs = new Map<number, WeaponPlug>();
const compactPlugSets: number[][] = [];
const compactPlugSetIds = new Map<string, number>();

const weapons = Object.values(inventoryItems)
    .filter(isVisibleWeapon)
    .map(buildWeapon)
    .sort((left, right) => left.name.localeCompare(right.name) || right.hash - left.hash);

const catalog: WeaponCatalog = {
    schemaVersion: 1,
    manifestVersion: manifest.Response.version ?? 'unknown',
    generatedAt: new Date().toISOString(),
    weapons,
    plugs: Object.fromEntries([...usedPlugs.entries()].sort(([left], [right]) => left - right).map(([hash, plug]) => [String(hash), plug])),
    plugSets: compactPlugSets,
    statGroups: Object.fromEntries(
        [...new Set(weapons.flatMap((weapon) => (weapon.statGroupHash ? [weapon.statGroupHash] : [])))]
            .sort((left, right) => left - right)
            .flatMap((hash) => {
                const group = statGroups[String(hash)];
                if (!group) return [];
                return [
                    [
                        String(hash),
                        {
                            maximumValue: group.maximumValue,
                            scaledStats: Object.fromEntries(
                                group.scaledStats.map((stat) => [
                                    String(stat.statHash),
                                    {
                                        maximumValue: stat.maximumValue,
                                        displayInterpolation: stat.displayInterpolation
                                            .map((point) => [point.value, point.weight] as [number, number])
                                            .sort(([left], [right]) => left - right)
                                    }
                                ])
                            )
                        }
                    ]
                ];
            })
    )
};

mkdirSync(dirname(outputPath), { recursive: true });
await Bun.write(outputPath, JSON.stringify(catalog));

const size = Bun.file(outputPath).size;
console.log(
    `Weapon catalog ${catalog.manifestVersion}: ${weapons.length} weapons, ${usedPlugs.size} plugs, ${compactPlugSets.length} plug sets, ${(size / 1024 / 1024).toFixed(2)} MiB`
);

function isVisibleWeapon(definition: DestinyInventoryItemDefinition) {
    return (
        definition.itemType === WEAPON_ITEM_TYPE &&
        definition.equippable &&
        !definition.redacted &&
        Boolean(definition.displayProperties?.name) &&
        Boolean(definition.displayProperties?.icon)
    );
}

function buildWeapon(definition: DestinyInventoryItemDefinition): WeaponDefinition {
    const sockets = buildSockets(definition);
    const intrinsicHash = findIntrinsicHash(definition);
    const intrinsic = intrinsicHash ? inventoryItems[String(intrinsicHash)] : undefined;
    if (intrinsic) {
        usedPlugs.set(intrinsic.hash, compactPlug(intrinsic));
    }
    const collectible = definition.collectibleHash ? collectibles[String(definition.collectibleHash)] : undefined;

    return {
        hash: definition.hash,
        name: definition.displayProperties.name,
        description: definition.displayProperties.description,
        flavorText: definition.flavorText,
        icon: definition.displayProperties.icon ?? '',
        watermark: definition.iconWatermark,
        screenshot: definition.screenshot,
        type: definition.itemTypeDisplayName,
        subtype: definition.itemSubType,
        element: elementName(definition.defaultDamageType),
        ammo: ammoName(definition.equippingBlock?.ammoType),
        slot: slotName(definition.equippingBlock?.equipmentSlotTypeHash),
        rarity: rarityName(definition.inventory?.tierType),
        source: collectible?.sourceString || definition.displaySource || '',
        seasonHash: definition.seasonHash ?? null,
        statGroupHash: definition.stats?.statGroupHash ?? null,
        intrinsicHash,
        intrinsicName: intrinsic?.displayProperties?.name ?? '',
        adept: definition.isAdept,
        craftable: Boolean(definition.inventory?.recipeItemHash),
        investmentStats: Object.fromEntries(
            definition.investmentStats
                .filter((stat) => stat.isConditionallyActive === false && stat.value !== 0)
                .map((stat) => [String(stat.statTypeHash), stat.value])
        ),
        stats: Object.values(definition.stats?.stats ?? {})
            .map((stat) => ({
                hash: stat.statHash,
                name: statDefinitions[String(stat.statHash)]?.displayProperties?.name ?? `Stat ${stat.statHash}`,
                value: stat.value,
                maximum: stat.displayMaximum ?? 100
            }))
            .filter((stat) => stat.hash !== 1480404414 && stat.name.trim())
            .sort((left, right) => statOrder(left.hash) - statOrder(right.hash)),
        sockets
    };
}

function buildSockets(definition: DestinyInventoryItemDefinition): WeaponSocket[] {
    const sockets: WeaponSocket[] = [];
    for (const [index, socket] of (definition.sockets?.socketEntries ?? []).entries()) {
        if (!socket.defaultVisible) {
            continue;
        }

        const plugHashes = new Set<number>();
        for (const plug of socket.reusablePlugItems ?? []) {
            plugHashes.add(plug.plugItemHash);
        }
        for (const setHash of [socket.randomizedPlugSetHash, socket.reusablePlugSetHash]) {
            if (!setHash) {
                continue;
            }
            for (const plug of plugSets[String(setHash)]?.reusablePlugItems ?? []) {
                if (plug.currentlyCanRoll) {
                    plugHashes.add(plug.plugItemHash);
                }
            }
        }
        if (socket.singleInitialItemHash) {
            plugHashes.add(socket.singleInitialItemHash);
        }

        const whitelist = (socketTypes[String(socket.socketTypeHash)]?.plugWhitelist ?? []).map((entry) => entry.categoryHash);
        const intrinsicHash = findIntrinsicHash(definition);
        const intrinsicName = intrinsicHash ? (inventoryItems[String(intrinsicHash)]?.displayProperties?.name ?? '') : '';
        const plugs = filterPlugChoices(
            [...plugHashes]
                .map((hash) => inventoryItems[String(hash)])
                .filter(
                    (plug): plug is DestinyInventoryItemDefinition =>
                        Boolean(plug?.displayProperties?.name) &&
                        !plug.redacted &&
                        isPlugAllowedBySocketType(plug.plug?.plugCategoryHash ?? 0, whitelist, plug.hash === socket.singleInitialItemHash)
                ),
            socket.singleInitialItemHash || null,
            definition.itemTypeDisplayName,
            intrinsicName
        );
        if (plugs.length === 0) {
            continue;
        }

        const category = mostUsefulCategory(plugs);
        if (!isEditableWeaponCategory(category)) {
            continue;
        }

        for (const plug of plugs) {
            usedPlugs.set(plug.hash, compactPlug(plug));
        }

        sockets.push({
            index,
            label: socketLabel(category, plugs[0]?.itemTypeDisplayName ?? ''),
            category,
            initialPlugHash: plugs.some((plug) => plug.hash === socket.singleInitialItemHash) ? socket.singleInitialItemHash : null,
            plugSet: compactPlugSet(plugs.map((plug) => plug.hash))
        });
    }

    return sockets;
}

function findIntrinsicHash(definition: DestinyInventoryItemDefinition) {
    for (const socket of definition.sockets?.socketEntries ?? []) {
        const hash = socket.singleInitialItemHash;
        const plug = hash ? inventoryItems[String(hash)] : undefined;
        const category = plug?.plug?.plugCategoryIdentifier.toLowerCase() ?? '';
        if (plug?.itemTypeDisplayName.toLowerCase() === 'intrinsic' || category.includes('intrinsic')) {
            return hash;
        }
    }

    return null;
}

function filterPlugChoices(
    plugs: DestinyInventoryItemDefinition[],
    initialPlugHash: number | null,
    weaponType: string,
    intrinsicName: string
) {
    const isMasterwork = plugs.some((plug) => plug.plug?.plugCategoryIdentifier.toLowerCase().includes('masterwork'));
    const candidates = isMasterwork
        ? plugs.filter(
              (plug) =>
                  plug.hash === initialPlugHash ||
                  (plug.displayProperties.name.startsWith('Masterworked:') &&
                      isObservedWeaponMasterwork(observedMasterworkStats, weaponType, intrinsicName, plug.displayProperties.name))
          )
        : plugs;
    const unique = new Map<string, DestinyInventoryItemDefinition>();
    for (const plug of candidates) {
        const stats = plug.investmentStats
            .filter((stat) => stat.isConditionallyActive === false && stat.value !== 0)
            .map((stat) => `${stat.statTypeHash}:${stat.value}`)
            .sort()
            .join(',');
        const enhanced =
            plug.plug?.plugCategoryIdentifier.toLowerCase().includes('enhance') ||
            plug.displayProperties.name.toLowerCase().includes('enhanced');
        const key = `${plug.plug?.plugCategoryIdentifier ?? ''}|${plug.displayProperties.name}|${stats}|${enhanced}`;
        if (!unique.has(key) || plug.hash === initialPlugHash) unique.set(key, plug);
    }
    return [...unique.values()];
}

function collectObservedMasterworkStats() {
    const observed = new Map<string, Set<string>>();
    for (const definition of Object.values(inventoryItems).filter(isVisibleWeapon)) {
        const intrinsicHash = findIntrinsicHash(definition);
        const intrinsicName = intrinsicHash ? (inventoryItems[String(intrinsicHash)]?.displayProperties?.name ?? '') : '';
        const key = masterworkFamilyKey(definition.itemTypeDisplayName, intrinsicName);
        for (const socket of definition.sockets?.socketEntries ?? []) {
            const plug = socket.singleInitialItemHash ? inventoryItems[String(socket.singleInitialItemHash)] : undefined;
            if (!plug?.plug?.plugCategoryIdentifier.toLowerCase().includes('masterwork')) continue;
            const statName = masterworkStatName(plug.displayProperties.name);
            if (!statName) continue;
            const stats = observed.get(key) ?? new Set<string>();
            stats.add(statName);
            observed.set(key, stats);
        }
    }
    return observed;
}

function compactPlugSet(hashes: number[]) {
    const key = hashes.join(',');
    const existing = compactPlugSetIds.get(key);
    if (existing !== undefined) {
        return existing;
    }

    const id = compactPlugSets.length;
    compactPlugSets.push(hashes);
    compactPlugSetIds.set(key, id);
    return id;
}

function compactPlug(definition: DestinyInventoryItemDefinition): WeaponPlug {
    const category = definition.plug?.plugCategoryIdentifier ?? '';
    return {
        hash: definition.hash,
        name: definition.displayProperties.name,
        description: definition.displayProperties.description,
        icon: definition.displayProperties.icon,
        category,
        label: definition.itemTypeDisplayName,
        enhanced: category.toLowerCase().includes('enhance') || definition.displayProperties.name.toLowerCase().includes('enhanced'),
        stats: Object.fromEntries(
            definition.investmentStats
                .filter((stat) => stat.isConditionallyActive === false && stat.value !== 0)
                .map((stat) => [String(stat.statTypeHash), stat.value])
        )
    };
}

function mostUsefulCategory(plugs: DestinyInventoryItemDefinition[]) {
    const counts = new Map<string, number>();
    for (const plug of plugs) {
        const category = plug.plug?.plugCategoryIdentifier ?? '';
        counts.set(category, (counts.get(category) ?? 0) + 1);
    }

    return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? '';
}

function isEditableWeaponCategory(category: string) {
    const value = category.toLowerCase();
    const excluded = ['shader', 'memento', 'tracker', 'deepsight', 'infusion', 'empty', 'crafting.plugs', 'crafting_plugs'];
    if (excluded.some((part) => value.includes(part))) {
        return false;
    }

    return [
        'barrel',
        'scope',
        'magazine',
        'battery',
        'trait',
        'origin',
        'stock',
        'grip',
        'guard',
        'blade',
        'bowstring',
        'arrow',
        'grenade',
        'tube',
        'frame',
        'haft',
        'masterwork',
        'catalyst',
        'mod'
    ].some((part) => value.includes(part));
}

function socketLabel(category: string, fallback: string) {
    const value = category.toLowerCase();
    const labels: Array<[string, string]> = [
        ['barrel', 'Barrel'],
        ['scope', 'Scope'],
        ['bowstring', 'String'],
        ['arrow', 'Arrow'],
        ['magazine', 'Magazine'],
        ['battery', 'Battery'],
        ['grenade', 'Payload'],
        ['tube', 'Magazine'],
        ['blade', 'Blade'],
        ['guard', 'Guard'],
        ['haft', 'Haft'],
        ['frame', 'Trait'],
        ['stock', 'Stock'],
        ['grip', 'Grip'],
        ['origin', 'Origin trait'],
        ['masterwork', 'Masterwork'],
        ['catalyst', 'Catalyst'],
        ['mod', 'Mod'],
        ['trait', 'Trait']
    ];
    return labels.find(([part]) => value.includes(part))?.[1] ?? (fallback || 'Socket');
}

function statOrder(hash: number) {
    const preferred = [
        4043523819, 1240592695, 155624089, 943549884, 4188031367, 1345609583, 3555269338, 2714457168, 2715839340, 4284893193, 3871231066,
        3614673599, 2523465841, 2961396640, 447667954
    ];
    const index = preferred.indexOf(hash);
    return index === -1 ? preferred.length : index;
}

function ammoName(value: number | undefined): WeaponAmmoType {
    return value === 1 ? 'primary' : value === 2 ? 'special' : value === 3 ? 'heavy' : 'unknown';
}

function elementName(value: number): WeaponElement {
    return value === 1
        ? 'kinetic'
        : value === 2
          ? 'arc'
          : value === 3
            ? 'solar'
            : value === 4
              ? 'void'
              : value === 6
                ? 'stasis'
                : value === 7
                  ? 'strand'
                  : 'unknown';
}

function slotName(value: number | undefined): WeaponSlot {
    return value === KINETIC_SLOT_HASH
        ? 'kinetic'
        : value === ENERGY_SLOT_HASH
          ? 'energy'
          : value === POWER_SLOT_HASH
            ? 'power'
            : 'unknown';
}

function rarityName(value: number | undefined): WeaponRarity {
    return value === 6
        ? 'exotic'
        : value === 5
          ? 'legendary'
          : value === 4
            ? 'rare'
            : value === 3
              ? 'uncommon'
              : value === 2
                ? 'common'
                : 'unknown';
}
