import type { DestinyManifest, LoadedManifestResolver, ManifestInventoryItemDefinition, ManifestResponse } from '@/features/armor/types';
import { getBungieConfig } from '@/features/bungie/config';
import { readJsonCache, writeJsonCache } from '@/features/storage/indexed-json';

const BUNGIE_ORIGIN = 'https://www.bungie.net';
const BUNGIE_PLATFORM_BASE_URL = `${BUNGIE_ORIGIN}/Platform`;
const INVENTORY_ITEM_DEFINITION = 'DestinyInventoryItemDefinition';
const MANIFEST_CACHE_KEY = 'manifest.inventory-item-definitions';

type ManifestCache = {
    version?: string;
    cachedAt: string;
    inventoryItemDefinitions: Record<string, ManifestInventoryItemDefinition>;
};

type ManifestResolverOptions = {
    onStatus?: (message: string) => void;
};

export async function createBungieManifestResolver(options: ManifestResolverOptions = {}): Promise<LoadedManifestResolver> {
    const memoryCache = new Map<number, ManifestInventoryItemDefinition | null>();
    const manifestCache = await readOrRefreshManifestCache(options);

    return {
        getLoadedInventoryItemDefinitions() {
            return [...memoryCache.entries()]
                .filter((entry): entry is [number, ManifestInventoryItemDefinition] => entry[1] !== null)
                .map(([hash, definition]) => ({
                    hash,
                    definition
                }));
        },
        getManifestCacheMetadata() {
            return {
                version: manifestCache?.version,
                cachedAt: manifestCache?.cachedAt,
                definitionCount: Object.keys(manifestCache?.inventoryItemDefinitions ?? {}).length,
                fullCacheAvailable: Boolean(manifestCache)
            };
        },
        async getInventoryItem(hash: number) {
            if (memoryCache.has(hash)) {
                return memoryCache.get(hash) ?? null;
            }

            const cachedDefinition = manifestCache?.inventoryItemDefinitions[String(hash)];
            if (cachedDefinition) {
                memoryCache.set(hash, cachedDefinition);
                return cachedDefinition;
            }

            const fetchedDefinition = await fetchInventoryItemDefinition(hash);
            memoryCache.set(hash, fetchedDefinition);
            return fetchedDefinition;
        }
    };
}

async function readOrRefreshManifestCache(options: ManifestResolverOptions) {
    const cached = await readJsonCache<ManifestCache>(MANIFEST_CACHE_KEY).catch(() => null);

    options.onStatus?.('Checking Bungie manifest version');
    const manifest = await fetchManifestIndex().catch(() => null);
    const cachedManifest = cached?.value ?? null;

    if (!manifest) {
        options.onStatus?.(cachedManifest ? 'Using cached manifest definitions; version check failed' : 'Manifest version check failed');
        return cachedManifest;
    }

    if (cachedManifest && cachedManifest.version === manifest.version && Object.keys(cachedManifest.inventoryItemDefinitions).length > 0) {
        options.onStatus?.(`Using cached manifest ${manifest.version}`);
        return cachedManifest;
    }

    const inventoryPath = manifest.jsonWorldComponentContentPaths?.en?.[INVENTORY_ITEM_DEFINITION];
    if (!inventoryPath) {
        options.onStatus?.(
            cachedManifest ? 'Using cached manifest definitions; inventory path missing' : 'Manifest inventory path missing'
        );
        return cachedManifest;
    }

    options.onStatus?.(`Downloading manifest ${manifest.version ?? 'unknown version'}`);
    const inventoryItemDefinitions = await fetchWorldComponent<ManifestInventoryItemDefinition>(inventoryPath);
    const nextCache: ManifestCache = {
        version: manifest.version,
        cachedAt: new Date().toISOString(),
        inventoryItemDefinitions
    };

    await writeJsonCache(MANIFEST_CACHE_KEY, nextCache);
    options.onStatus?.(`Cached ${Object.keys(inventoryItemDefinitions).length} manifest inventory definitions`);
    return nextCache;
}

async function fetchManifestIndex() {
    const config = getBungieConfig();
    const response = await fetch(`${BUNGIE_PLATFORM_BASE_URL}/Destiny2/Manifest/`, {
        headers: {
            'X-API-Key': config.apiKey
        }
    });
    const payload = (await response.json().catch(() => null)) as ManifestResponse<DestinyManifest> | null;

    if (!response.ok || !payload?.Response || (payload.ErrorCode && payload.ErrorCode !== 1)) {
        throw new Error(`Bungie manifest request failed (${response.status})`);
    }

    return payload.Response;
}

async function fetchWorldComponent<T>(path: string) {
    const response = await fetch(`${BUNGIE_ORIGIN}${path}`);
    const payload = (await response.json().catch(() => null)) as Record<string, T> | null;

    if (!response.ok || !payload) {
        throw new Error(`Bungie manifest component request failed (${response.status})`);
    }

    return payload;
}

async function fetchInventoryItemDefinition(hash: number) {
    const config = getBungieConfig();
    const response = await fetch(`${BUNGIE_PLATFORM_BASE_URL}/Destiny2/Manifest/DestinyInventoryItemDefinition/${hash}/`, {
        headers: {
            'X-API-Key': config.apiKey
        }
    });
    const payload = (await response.json().catch(() => null)) as ManifestResponse<ManifestInventoryItemDefinition> | null;

    if (!response.ok || !payload?.Response || (payload.ErrorCode && payload.ErrorCode !== 1)) {
        return null;
    }

    return payload.Response;
}
