import {
    type DestinyEquipableItemSetDefinition,
    type DestinyInventoryItemDefinition,
    type DestinyManifestComponentName,
    type DestinySandboxPerkDefinition,
    getDestinyEntityDefinition,
    getDestinyManifest,
    getDestinyManifestSlice,
    type PlatformErrorCodes,
    type ServerResponse
} from 'bungie-api-ts/destiny2';
import type { HttpClient, HttpClientConfig } from 'bungie-api-ts/http';

import type { LoadedManifestResolver } from '@/features/armor/types';
import { getBungieConfig } from '@/features/bungie/config';
import { readJsonCache, writeJsonCache } from '@/features/storage/indexed-json';

const INVENTORY_ITEM_DEFINITION = 'DestinyInventoryItemDefinition' satisfies DestinyManifestComponentName;
const EQUIPABLE_ITEM_SET_DEFINITION = 'DestinyEquipableItemSetDefinition' satisfies DestinyManifestComponentName;
const SANDBOX_PERK_DEFINITION = 'DestinySandboxPerkDefinition' satisfies DestinyManifestComponentName;
const MANIFEST_COMPONENTS = [
    INVENTORY_ITEM_DEFINITION,
    EQUIPABLE_ITEM_SET_DEFINITION,
    SANDBOX_PERK_DEFINITION
] as const satisfies readonly DestinyManifestComponentName[];
const MANIFEST_CACHE_KEY = 'manifest.calculator-definitions.v2';
const BUNGIE_SUCCESS_ERROR_CODE = 1 satisfies PlatformErrorCodes;

type ManifestCache = {
    version?: string;
    cachedAt: string;
    inventoryItemDefinitions: Record<string, DestinyInventoryItemDefinition>;
    equipableItemSetDefinitions: Record<string, DestinyEquipableItemSetDefinition>;
    sandboxPerkDefinitions: Record<string, DestinySandboxPerkDefinition>;
};

type ManifestResolverOptions = {
    onStatus?: (message: string) => void;
};

export async function createBungieManifestResolver(options: ManifestResolverOptions = {}): Promise<LoadedManifestResolver> {
    const memoryCache = new Map<number, DestinyInventoryItemDefinition | null>();
    const sandboxPerkMemoryCache = new Map<number, DestinySandboxPerkDefinition | null>();
    const manifestCache = await readOrRefreshManifestCache(options);

    return {
        getEquipableItemSetDefinitions() {
            return Object.entries(manifestCache?.equipableItemSetDefinitions ?? {}).map(([hash, definition]) => ({
                hash: Number(hash),
                definition
            }));
        },
        getLoadedInventoryItemDefinitions() {
            return [...memoryCache.entries()]
                .filter((entry): entry is [number, DestinyInventoryItemDefinition] => entry[1] !== null)
                .map(([hash, definition]) => ({
                    hash,
                    definition
                }));
        },
        getInventoryItemDefinitionsByPlugCategory(plugCategoryIdentifier: string) {
            return Object.entries(manifestCache?.inventoryItemDefinitions ?? {})
                .filter(([, definition]) => definition.plug?.plugCategoryIdentifier === plugCategoryIdentifier)
                .map(([hash, definition]) => ({
                    hash: Number(hash),
                    definition
                }));
        },
        getManifestCacheMetadata() {
            return {
                version: manifestCache?.version,
                cachedAt: manifestCache?.cachedAt,
                definitionCount: Object.keys(manifestCache?.inventoryItemDefinitions ?? {}).length,
                equipableItemSetDefinitionCount: Object.keys(manifestCache?.equipableItemSetDefinitions ?? {}).length,
                sandboxPerkDefinitionCount: Object.keys(manifestCache?.sandboxPerkDefinitions ?? {}).length,
                fullCacheAvailable: Boolean(manifestCache && isCompleteManifestCache(manifestCache))
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
        },
        async getSandboxPerk(hash: number) {
            if (sandboxPerkMemoryCache.has(hash)) {
                return sandboxPerkMemoryCache.get(hash) ?? null;
            }

            const cachedDefinition = manifestCache?.sandboxPerkDefinitions[String(hash)] ?? null;
            sandboxPerkMemoryCache.set(hash, cachedDefinition);
            return cachedDefinition;
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

    if (cachedManifest && cachedManifest.version === manifest.version && isCompleteManifestCache(cachedManifest)) {
        options.onStatus?.(`Using cached manifest ${manifest.version}`);
        return cachedManifest;
    }

    const englishManifestPaths = manifest.jsonWorldComponentContentPaths?.['en'];
    if (
        !englishManifestPaths?.[INVENTORY_ITEM_DEFINITION] ||
        !englishManifestPaths[EQUIPABLE_ITEM_SET_DEFINITION] ||
        !englishManifestPaths[SANDBOX_PERK_DEFINITION]
    ) {
        options.onStatus?.(
            cachedManifest ? 'Using cached manifest definitions; manifest paths missing' : 'Manifest definition paths missing'
        );
        return cachedManifest;
    }

    options.onStatus?.(`Downloading manifest ${manifest.version ?? 'unknown version'}`);
    const manifestSlice = await getDestinyManifestSlice(createManifestHttp(), {
        destinyManifest: manifest,
        tableNames: [...MANIFEST_COMPONENTS],
        language: 'en'
    });
    const inventoryItemDefinitions = manifestSlice.DestinyInventoryItemDefinition;
    const equipableItemSetDefinitions = manifestSlice.DestinyEquipableItemSetDefinition;
    const sandboxPerkDefinitions = manifestSlice.DestinySandboxPerkDefinition;
    const nextCache: ManifestCache = {
        version: manifest.version,
        cachedAt: new Date().toISOString(),
        inventoryItemDefinitions,
        equipableItemSetDefinitions,
        sandboxPerkDefinitions
    };

    await writeJsonCache(MANIFEST_CACHE_KEY, nextCache);
    options.onStatus?.(
        `Cached ${Object.keys(inventoryItemDefinitions).length} items, ${Object.keys(equipableItemSetDefinitions).length} sets`
    );
    return nextCache;
}

function isCompleteManifestCache(cache: ManifestCache) {
    return (
        Object.keys(cache.inventoryItemDefinitions ?? {}).length > 0 &&
        Object.keys(cache.equipableItemSetDefinitions ?? {}).length > 0 &&
        Object.keys(cache.sandboxPerkDefinitions ?? {}).length > 0
    );
}

function createManifestHttp(): HttpClient {
    return async <Return>(request: HttpClientConfig) => {
        const config = getBungieConfig();
        const url = new URL(request.url);
        for (const [key, value] of Object.entries(request.params ?? {})) {
            url.searchParams.set(key, value);
        }

        const requestInit: RequestInit = {
            method: request.method,
            headers: {
                'X-API-Key': config.apiKey
            }
        };
        if (request.body) {
            requestInit.body = JSON.stringify(request.body);
        }

        const response = await fetch(url, requestInit);
        const payload = (await response.json().catch(() => null)) as Return | null;

        if (!response.ok || !payload) {
            throw new Error(`Bungie manifest request failed (${response.status})`);
        }

        return payload;
    };
}

function assertManifestResponse<T>(payload: ServerResponse<T>) {
    if (payload.ErrorCode !== BUNGIE_SUCCESS_ERROR_CODE) {
        throw new Error(payload.Message || payload.ErrorStatus || 'Bungie manifest request failed');
    }
}

async function fetchManifestIndex() {
    const payload = await getDestinyManifest(createManifestHttp());
    assertManifestResponse(payload);

    return payload.Response;
}

async function fetchInventoryItemDefinition(hash: number) {
    const payload = await getDestinyEntityDefinition(createManifestHttp(), {
        entityType: INVENTORY_ITEM_DEFINITION,
        hashIdentifier: hash
    }).catch(() => null);

    if (!payload?.Response || payload.ErrorCode !== BUNGIE_SUCCESS_ERROR_CODE) {
        return null;
    }

    return payload.Response as DestinyInventoryItemDefinition;
}
