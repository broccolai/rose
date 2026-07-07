import {
    type DestinyInsertPlugsFreeActionRequest as BungieDestinyInsertPlugsFreeActionRequest,
    type DestinyItemActionRequest as BungieDestinyItemActionRequest,
    type DestinyItemSetActionRequest as BungieDestinyItemSetActionRequest,
    type DestinyItemTransferRequest as BungieDestinyItemTransferRequest,
    equipItem as bungieEquipItem,
    equipItems as bungieEquipItems,
    getProfile as bungieGetProfile,
    insertSocketPlugFree as bungieInsertSocketPlugFree,
    transferItem as bungieTransferItem,
    type DestinyEquipItemResults
} from 'bungie-api-ts/destiny2';
import type { HttpClient, HttpClientConfig } from 'bungie-api-ts/http';
import { getMembershipDataForCurrentUser } from 'bungie-api-ts/user';

import { getBungieConfig } from '@/features/bungie/config';
import type { BungieToken } from '@/features/bungie/oauth';
import { readJsonCache, writeJsonCache } from '@/features/storage/indexed-json';

const VAULT_SNAPSHOT_CACHE_KEY = 'bungie.vault-snapshot';
const STADIA_MEMBERSHIP_TYPE = 5;
const TRANSFER_OR_EQUIP_ACTION_INTERVAL_MS = 100;
const SOCKET_ACTION_INTERVAL_MS = 500;

export const DESTINY_PROFILE_COMPONENTS = {
    Profiles: 100,
    ProfileInventories: 102,
    Characters: 200,
    CharacterInventories: 201,
    CharacterEquipment: 205,
    ItemInstances: 300,
    ItemPerks: 302,
    ItemStats: 304,
    ItemSockets: 305,
    ItemPlugStates: 308,
    ItemReusablePlugs: 310,
    Collectibles: 800
} as const;

type BungieResponse<T> = {
    Response?: T;
    ErrorCode?: number;
    ErrorStatus?: string;
    Message?: string;
    [key: string]: unknown;
};

type DestinyMembership = {
    membershipId: string;
    membershipType: number;
    displayName?: string;
    bungieGlobalDisplayName?: string;
    bungieGlobalDisplayNameCode?: number;
    crossSaveOverride?: number;
    [key: string]: unknown;
};

type CurrentMembershipsPayload = {
    destinyMemberships?: DestinyMembership[];
    primaryMembershipId?: string;
    bungieNetUser?: unknown;
    [key: string]: unknown;
};

type SelectedMembership = DestinyMembership & {
    selectionReason: string;
};

type BungieFetchOptions = {
    logLabel?: string;
};

export type DestinyItemTransferRequest = {
    itemReferenceHash: number;
    stackSize: number;
    transferToVault: boolean;
    itemId: string;
    characterId: string;
    membershipType: number;
};

export type DestinyEquipItemRequest = {
    itemId: string;
    characterId: string;
    membershipType: number;
};

export type DestinyEquipItemsRequest = {
    itemIds: string[];
    characterId: string;
    membershipType: number;
};

export type DestinyInsertPlugsRequestEntry = {
    socketIndex: number;
    socketArrayType: number;
    plugItemHash: number;
};

export type DestinyInsertPlugsFreeActionRequest = {
    plug: DestinyInsertPlugsRequestEntry;
    itemId: string;
    characterId: string;
    membershipType: number;
};

function requestedComponentIds() {
    return Object.values(DESTINY_PROFILE_COMPONENTS);
}

function assertBungieSuccess<T>(payload: BungieResponse<T>, fallbackMessage: string, logDetails?: Record<string, unknown>) {
    if (payload.ErrorCode !== undefined && payload.ErrorCode !== 1) {
        console.error('[rose bungie api] Bungie returned an error', {
            ...logDetails,
            errorCode: payload.ErrorCode,
            errorStatus: payload.ErrorStatus,
            message: payload.Message,
            payload
        });
        throw new Error(`${payload.ErrorStatus ?? fallbackMessage}: ${payload.Message ?? 'Unknown Bungie API error'}`);
    }
}

function createBungieHttp(token: BungieToken, options: BungieFetchOptions = {}): HttpClient {
    return async <Return>(request: HttpClientConfig) => {
        const config = getBungieConfig();
        const url = new URL(request.url);
        for (const [key, value] of Object.entries(request.params ?? {})) {
            url.searchParams.set(key, value);
        }

        const response = await fetch(url, {
            method: request.method,
            headers: {
                Authorization: `Bearer ${token.accessToken}`,
                ...(request.body ? { 'Content-Type': 'application/json' } : {}),
                'X-API-Key': config.apiKey
            },
            body: request.body ? JSON.stringify(request.body) : undefined
        });
        const payload = (await response.json().catch(() => null)) as BungieResponse<Return> | null;

        if (!response.ok || !payload) {
            console.error('[rose bungie api] Request failed', {
                label: options.logLabel,
                url: url.toString(),
                method: request.method,
                status: response.status,
                requestBody: request.body,
                payload
            });
            throw new Error(`Bungie request failed (${response.status})`);
        }

        assertBungieSuccess(payload, `Bungie request failed for ${url.pathname}`, {
            label: options.logLabel,
            url: url.toString(),
            method: request.method,
            requestBody: request.body
        });

        return payload as Return;
    };
}

const lastActionAtByGroup = new Map<string, number>();

async function paceBungieAction(group: string, intervalMs: number) {
    const now = Date.now();
    const lastActionAt = lastActionAtByGroup.get(group) ?? 0;
    const waitMs = Math.max(0, lastActionAt + intervalMs - now);
    if (waitMs > 0) {
        await new Promise((resolve) => globalThis.setTimeout(resolve, waitMs));
    }

    lastActionAtByGroup.set(group, Date.now());
}

async function callBungieApi<T>(
    token: BungieToken,
    logLabel: string,
    call: (http: HttpClient) => Promise<unknown>
): Promise<BungieResponse<T>> {
    return (await call(createBungieHttp(token, { logLabel }))) as BungieResponse<T>;
}

async function bungieFetch<T>(
    token: BungieToken,
    options: BungieFetchOptions,
    call: (http: HttpClient) => Promise<unknown>
): Promise<BungieResponse<T>> {
    return callBungieApi(token, options.logLabel ?? 'bungie api', call);
}

export async function fetchCurrentMemberships(token: BungieToken) {
    return bungieFetch<CurrentMembershipsPayload>(token, { logLabel: 'current memberships' }, (http) =>
        getMembershipDataForCurrentUser(http)
    );
}

export function selectDestinyMembership(membershipsResponse: BungieResponse<CurrentMembershipsPayload>): SelectedMembership {
    const response = membershipsResponse.Response;
    const memberships = response?.destinyMemberships ?? [];

    if (memberships.length === 0) {
        throw new Error('No Destiny memberships were returned for this Bungie account.');
    }

    const nonStadiaMemberships = memberships.filter((membership) => membership.membershipType !== STADIA_MEMBERSHIP_TYPE);
    const crossSaveMemberships = memberships.filter((membership) => membership.crossSaveOverride === membership.membershipType);
    const primaryMembership = memberships.find((membership) => membership.membershipId === response?.primaryMembershipId);

    const selected = crossSaveMemberships[0] ?? primaryMembership ?? nonStadiaMemberships[0] ?? memberships[0];
    const selectionReason = crossSaveMemberships[0]
        ? 'cross-save override matched membership type'
        : primaryMembership
          ? 'matched primaryMembershipId'
          : nonStadiaMemberships[0]
            ? 'first non-Stadia membership'
            : 'first available membership';

    return {
        ...selected,
        selectionReason
    };
}

export async function fetchProfile(token: BungieToken, membership: SelectedMembership) {
    return bungieFetch<Record<string, unknown>>(token, { logLabel: 'profile' }, (http) =>
        bungieGetProfile(http, {
            components: requestedComponentIds(),
            destinyMembershipId: membership.membershipId,
            membershipType: membership.membershipType
        })
    );
}

export async function transferDestinyItem(token: BungieToken, request: DestinyItemTransferRequest) {
    await paceBungieAction('transfer-or-equip', TRANSFER_OR_EQUIP_ACTION_INTERVAL_MS);
    return bungieFetch<number>(token, { logLabel: 'transfer item' }, (http) =>
        bungieTransferItem(http, request as BungieDestinyItemTransferRequest)
    );
}

export async function equipDestinyItem(token: BungieToken, request: DestinyEquipItemRequest) {
    await paceBungieAction('transfer-or-equip', TRANSFER_OR_EQUIP_ACTION_INTERVAL_MS);
    return bungieFetch<number>(token, { logLabel: 'equip item' }, (http) =>
        bungieEquipItem(http, request as BungieDestinyItemActionRequest)
    );
}

export async function equipDestinyItems(token: BungieToken, request: DestinyEquipItemsRequest) {
    await paceBungieAction('transfer-or-equip', TRANSFER_OR_EQUIP_ACTION_INTERVAL_MS);
    return bungieFetch<DestinyEquipItemResults>(token, { logLabel: 'equip items' }, (http) =>
        bungieEquipItems(http, request as BungieDestinyItemSetActionRequest)
    );
}

export async function insertSocketPlugFree(token: BungieToken, request: DestinyInsertPlugsFreeActionRequest) {
    await paceBungieAction('socket insert', SOCKET_ACTION_INTERVAL_MS);
    return bungieFetch<unknown>(token, { logLabel: 'insert socket plug free' }, (http) =>
        bungieInsertSocketPlugFree(http, request as BungieDestinyInsertPlugsFreeActionRequest)
    );
}

export async function exportVaultSnapshot(token: BungieToken) {
    const membershipsResponse = await fetchCurrentMemberships(token);
    const selectedMembership = selectDestinyMembership(membershipsResponse);
    const profileResponse = await fetchProfile(token, selectedMembership);
    const exportedAt = new Date().toISOString();

    const snapshot = {
        metadata: {
            app: 'rose-vault-export',
            exportVersion: 1,
            exportedAt,
            profileComponentNames: Object.keys(DESTINY_PROFILE_COMPONENTS),
            profileComponentIds: requestedComponentIds()
        },
        selectedMembership,
        membershipsResponse,
        profileResponse
    };

    await writeCachedVaultSnapshot(snapshot);
    return snapshot;
}

export async function readCachedVaultSnapshot() {
    return (
        (await readJsonCache<Awaited<ReturnType<typeof exportVaultSnapshot>>>(VAULT_SNAPSHOT_CACHE_KEY).catch(() => null))?.value ?? null
    );
}

export async function writeCachedVaultSnapshot(snapshot: Awaited<ReturnType<typeof exportVaultSnapshot>>) {
    await writeJsonCache(VAULT_SNAPSHOT_CACHE_KEY, snapshot);
}

export function downloadJsonFile(data: unknown, filePrefix = 'rose-vault-export') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = `${filePrefix}-${timestamp}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}
