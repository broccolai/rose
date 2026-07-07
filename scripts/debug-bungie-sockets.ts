type BungieResponse<T> = {
    Response?: T;
    ErrorCode?: number;
    ErrorStatus?: string;
    Message?: string;
};

type Membership = {
    membershipId: string;
    membershipType: number;
    displayName?: string;
    bungieGlobalDisplayName?: string;
    crossSaveOverride?: number;
};

type ProfileItem = {
    itemHash: number;
    itemInstanceId?: string;
    bucketHash?: number;
};

type InventoryItemDefinition = {
    displayProperties?: {
        name?: string;
        description?: string;
    };
    investmentStats?: Array<{
        statTypeHash: number;
        value: number;
    }>;
    inventory?: {
        bucketTypeHash?: number;
    };
    plug?: {
        plugCategoryIdentifier?: string;
    };
};

type ProfileResponse = {
    profileInventory?: { data?: { items?: ProfileItem[] } };
    characterInventories?: { data?: Record<string, { items?: ProfileItem[] }> };
    characterEquipment?: { data?: Record<string, { items?: ProfileItem[] }> };
    itemComponents?: {
        sockets?: { data?: Record<string, { sockets?: Array<{ plugHash?: number }> }> };
        reusablePlugs?: {
            data?: Record<
                string,
                {
                    plugs?: Record<string, Array<{ plugItemHash?: number; canInsert?: boolean; enabled?: boolean }>>;
                }
            >;
        };
    };
};

type StoredToken = {
    accessToken?: string;
    expiresAt?: number;
    refreshToken?: string;
    refreshExpiresAt?: number;
    raw?: {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
        refresh_expires_in?: number;
    };
};

type TokenResponse = {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
    refresh_expires_in?: number;
};

type ManifestIndexResponse = {
    jsonWorldComponentContentPaths?: {
        en?: {
            DestinyInventoryItemDefinition?: string;
        };
    };
};

const BUNGIE_ORIGIN = 'https://www.bungie.net';
const BUNGIE_PLATFORM = `${BUNGIE_ORIGIN}/Platform`;
const TOKEN_ENDPOINT = `${BUNGIE_PLATFORM}/App/OAuth/Token/`;
const COMPONENTS = [100, 102, 200, 201, 205, 300, 302, 304, 305, 308, 310, 800].join(',');
const STAT_BY_HASH: Record<string, string> = {
    '392767087': 'health',
    '4244567218': 'melee',
    '1735777505': 'grenade',
    '144602215': 'super',
    '1943323491': 'class',
    '2996146975': 'weapons'
};
const ARMOR_STAT_ORDER = ['health', 'melee', 'grenade', 'super', 'class', 'weapons'] as const;
const GENERAL_ARMOR_MOD_PLUG_CATEGORY = 'enhancements.v2_general';
const ARMOR_ENHANCEMENT_PREFIX = 'enhancements.';

let token = '';
const apiKey = process.env.VITE_BUNGIE_API_KEY?.trim() || process.env.BUNGIE_API_KEY?.trim();
const clientId = process.env.VITE_BUNGIE_CLIENT_ID?.trim() || process.env.BUNGIE_CLIENT_ID?.trim();
const targetItemId = process.env.ROSE_ITEM_ID?.trim();
const targetItemName = process.env.ROSE_ITEM_NAME?.trim() || 'Reverie Dawn Hood';

const storedTokenInput = process.env.ROSE_BUNGIE_TOKEN_B64?.trim() ?? process.env.ROSE_BUNGIE_TOKEN?.trim();
if (!storedTokenInput) {
    throw new Error('Set ROSE_BUNGIE_TOKEN to an access token, or ROSE_BUNGIE_TOKEN_B64 to the base64 browser token JSON.');
}

if (!apiKey) {
    throw new Error('Set VITE_BUNGIE_API_KEY or BUNGIE_API_KEY.');
}

const definitionCache = new Map<number, InventoryItemDefinition | null>();
let inventoryDefinitions: Record<string, InventoryItemDefinition> | null = null;

function stripEnvAssignmentPrefix(value: string) {
    return value.replace(/^ROSE_BUNGIE_TOKEN_B64=/, '').replace(/^ROSE_BUNGIE_TOKEN=/, '');
}

function decodeBase64JsonIfPresent(value: string) {
    if (value.startsWith('{')) {
        return value;
    }

    try {
        const decoded = Buffer.from(value, 'base64').toString('utf8');
        return decoded.startsWith('{') ? decoded : value;
    } catch {
        return value;
    }
}

function parseStoredToken(value: string): StoredToken {
    value = decodeBase64JsonIfPresent(stripEnvAssignmentPrefix(value));

    if (!value.startsWith('{')) {
        return {
            accessToken: value
        };
    }

    const parsed = JSON.parse(value) as StoredToken;
    return {
        ...parsed,
        accessToken: parsed.accessToken ?? parsed.raw?.access_token,
        refreshToken: parsed.refreshToken ?? parsed.raw?.refresh_token
    };
}

async function resolveAccessToken() {
    const storedToken = parseStoredToken(storedTokenInput);
    if (storedToken.accessToken && (!storedToken.expiresAt || storedToken.expiresAt > Date.now() + 60_000)) {
        return storedToken.accessToken;
    }

    if (!storedToken.refreshToken) {
        throw new Error('The access token is expired or invalid, and no refresh token was provided.');
    }

    if (!clientId) {
        throw new Error('Set VITE_BUNGIE_CLIENT_ID or BUNGIE_CLIENT_ID to refresh a stored token JSON.');
    }

    const response = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-API-Key': apiKey
        },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: storedToken.refreshToken,
            client_id: clientId
        })
    });
    const payload = (await response.json().catch(() => null)) as TokenResponse | null;

    if (!response.ok || !payload?.access_token) {
        throw new Error(`Bungie token refresh failed (${response.status}).`);
    }

    console.log('[rose socket debug] Refreshed access token in memory only.');
    return payload.access_token;
}

async function bungieFetch<T>(path: string): Promise<BungieResponse<T>> {
    const response = await fetch(`${BUNGIE_PLATFORM}${path}`, {
        headers: {
            Authorization: `Bearer ${token}`,
            'X-API-Key': apiKey
        }
    });
    const payload = (await response.json().catch(() => null)) as BungieResponse<T> | null;

    if (!response.ok || !payload) {
        throw new Error(
            `Bungie request failed ${response.status} for ${path}: ${payload?.ErrorStatus ?? 'NoErrorStatus'} ${
                payload?.ErrorCode ?? 'NoErrorCode'
            } ${payload?.Message ?? 'No message'}`
        );
    }

    if (payload.ErrorCode && payload.ErrorCode !== 1) {
        throw new Error(`${payload.ErrorStatus ?? 'BungieError'}: ${payload.Message ?? 'Unknown Bungie API error'}`);
    }

    return payload;
}

async function getDefinition(hash: number): Promise<InventoryItemDefinition | null> {
    if (inventoryDefinitions) {
        return inventoryDefinitions[String(hash)] ?? null;
    }

    if (definitionCache.has(hash)) {
        return definitionCache.get(hash) ?? null;
    }

    const payload = await bungieFetch<InventoryItemDefinition>(`/Destiny2/Manifest/DestinyInventoryItemDefinition/${hash}/`).catch(
        () => null
    );
    const definition = payload?.Response ?? null;
    definitionCache.set(hash, definition);
    return definition;
}

async function loadInventoryDefinitions() {
    if (inventoryDefinitions) {
        return inventoryDefinitions;
    }

    const manifest = await bungieFetch<ManifestIndexResponse>('/Destiny2/Manifest/');
    const path = manifest.Response?.jsonWorldComponentContentPaths?.en?.DestinyInventoryItemDefinition;
    if (!path) {
        throw new Error('Bungie manifest did not include DestinyInventoryItemDefinition.');
    }

    console.log('[rose socket debug] Downloading inventory manifest definitions.');
    const response = await fetch(`${BUNGIE_ORIGIN}${path}`);
    const payload = (await response.json().catch(() => null)) as Record<string, InventoryItemDefinition> | null;
    if (!response.ok || !payload) {
        throw new Error(`Inventory manifest download failed (${response.status}).`);
    }

    inventoryDefinitions = payload;
    return payload;
}

function selectMembership(payload: BungieResponse<{ destinyMemberships?: Membership[]; primaryMembershipId?: string }>): Membership {
    const memberships = payload.Response?.destinyMemberships ?? [];
    const selected =
        memberships.find((membership) => membership.crossSaveOverride === membership.membershipType) ??
        memberships.find((membership) => membership.membershipId === payload.Response?.primaryMembershipId) ??
        memberships.find((membership) => membership.membershipType !== 5) ??
        memberships[0];

    if (!selected) {
        throw new Error('No Destiny memberships were returned.');
    }

    return selected;
}

function allProfileItems(profile: ProfileResponse) {
    const items: Array<{ item: ProfileItem; location: string; characterId?: string }> = [];

    for (const item of profile.profileInventory?.data?.items ?? []) {
        items.push({ item, location: 'vault' });
    }

    for (const [characterId, bucket] of Object.entries(profile.characterInventories?.data ?? {})) {
        for (const item of bucket.items ?? []) {
            items.push({ item, location: 'character inventory', characterId });
        }
    }

    for (const [characterId, bucket] of Object.entries(profile.characterEquipment?.data ?? {})) {
        for (const item of bucket.items ?? []) {
            items.push({ item, location: 'equipped', characterId });
        }
    }

    return items;
}

function statDeltas(definition: InventoryItemDefinition | null) {
    const deltas = Object.fromEntries(ARMOR_STAT_ORDER.map((stat) => [stat, 0])) as Record<(typeof ARMOR_STAT_ORDER)[number], number>;

    for (const stat of definition?.investmentStats ?? []) {
        const name = STAT_BY_HASH[String(stat.statTypeHash)];
        if (name && name in deltas) {
            deltas[name as keyof typeof deltas] += stat.value;
        }
    }

    return deltas;
}

function statDeltaText(deltas: Record<string, number>) {
    const entries = ARMOR_STAT_ORDER.filter((stat) => deltas[stat] !== 0).map((stat) => `${stat}:${deltas[stat]}`);
    return entries.length > 0 ? entries.join(' ') : '-';
}

function isArmorEnhancement(category: string | undefined) {
    return Boolean(category?.startsWith(ARMOR_ENHANCEMENT_PREFIX));
}

function isEmptyPlug(definition: InventoryItemDefinition | null) {
    const name = definition?.displayProperties?.name?.toLowerCase() ?? '';
    const total = Object.values(statDeltas(definition)).reduce((sum, value) => sum + value, 0);
    return name.includes('empty') && total === 0;
}

async function main() {
    console.log('[rose socket debug] Fetching current profile. Token will not be printed.');
    token = await resolveAccessToken();
    await loadInventoryDefinitions();
    const membershipsPayload = await bungieFetch<{ destinyMemberships?: Membership[]; primaryMembershipId?: string }>(
        '/User/GetMembershipsForCurrentUser/'
    );
    const membership = selectMembership(membershipsPayload);
    const profilePayload = await bungieFetch<ProfileResponse>(
        `/Destiny2/${membership.membershipType}/Profile/${membership.membershipId}/?components=${COMPONENTS}`
    );
    const profile = profilePayload.Response;

    if (!profile) {
        throw new Error('No profile response.');
    }

    const itemMatches = [];
    for (const entry of allProfileItems(profile)) {
        if (!entry.item.itemInstanceId) {
            continue;
        }

        const definition = await getDefinition(entry.item.itemHash);
        const name = definition?.displayProperties?.name ?? String(entry.item.itemHash);
        const matchesId = targetItemId && entry.item.itemInstanceId === targetItemId;
        const matchesName = !targetItemId && name.toLowerCase() === targetItemName.toLowerCase();
        if (matchesId || matchesName) {
            itemMatches.push({ ...entry, definition, name });
        }
    }

    if (itemMatches.length === 0) {
        throw new Error(`No item found for ${targetItemId ? `id ${targetItemId}` : `name "${targetItemName}"`}.`);
    }

    for (const match of itemMatches) {
        const itemInstanceId = match.item.itemInstanceId;
        if (!itemInstanceId) {
            continue;
        }

        console.log('');
        console.log(`Item: ${match.name}`);
        console.log(`Instance: ${itemInstanceId}`);
        console.log(`Location: ${match.location}${match.characterId ? ` on ${match.characterId}` : ''}`);

        const sockets = profile.itemComponents?.sockets?.data?.[itemInstanceId]?.sockets ?? [];
        const reusablePlugs = profile.itemComponents?.reusablePlugs?.data?.[itemInstanceId]?.plugs ?? {};

        for (const [socketIndex, socket] of sockets.entries()) {
            const currentDefinition = socket.plugHash ? await getDefinition(socket.plugHash) : null;
            const currentCategory = currentDefinition?.plug?.plugCategoryIdentifier;
            const reusable = reusablePlugs[String(socketIndex)] ?? [];
            const reusableReports = await Promise.all(
                reusable.map(async (plug) => {
                    const definition = plug.plugItemHash ? await getDefinition(plug.plugItemHash) : null;
                    return {
                        plug,
                        definition,
                        category: definition?.plug?.plugCategoryIdentifier,
                        deltas: statDeltas(definition)
                    };
                })
            );
            const relevant = isArmorEnhancement(currentCategory) || reusableReports.some((report) => isArmorEnhancement(report.category));

            if (!relevant) {
                continue;
            }

            const emptyPlug = reusableReports.find((report) => isEmptyPlug(report.definition));
            const plusTenClass = reusableReports.find(
                (report) => report.category === GENERAL_ARMOR_MOD_PLUG_CATEGORY && report.deltas.class === 10
            );

            console.log('');
            console.log(`Socket ${socketIndex}`);
            console.log(
                `  current: ${socket.plugHash ?? '-'} ${currentDefinition?.displayProperties?.name ?? '-'} [${currentCategory ?? '-'}] ${statDeltaText(statDeltas(currentDefinition))}`
            );
            console.log(
                `  empty candidate: ${emptyPlug?.plug.plugItemHash ?? '-'} ${emptyPlug?.definition?.displayProperties?.name ?? '-'} canInsert=${emptyPlug?.plug.canInsert ?? '-'} enabled=${emptyPlug?.plug.enabled ?? '-'}`
            );
            console.log(
                `  +10 class candidate: ${plusTenClass?.plug.plugItemHash ?? '-'} ${plusTenClass?.definition?.displayProperties?.name ?? '-'} canInsert=${plusTenClass?.plug.canInsert ?? '-'} enabled=${plusTenClass?.plug.enabled ?? '-'}`
            );
            console.log('  reusable enhancement plugs:');
            for (const report of reusableReports.filter((entry) => isArmorEnhancement(entry.category))) {
                console.log(
                    `    ${report.plug.plugItemHash ?? '-'} ${report.definition?.displayProperties?.name ?? '-'} [${report.category ?? '-'}] canInsert=${report.plug.canInsert ?? '-'} enabled=${report.plug.enabled ?? '-'} ${statDeltaText(report.deltas)}`
                );
            }
        }
    }
}

await main();
