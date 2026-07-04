import { getBungieConfig } from '@/features/bungie/config';
import type { BungieToken } from '@/features/bungie/oauth';
import { readJsonCache, writeJsonCache } from '@/features/storage/indexed-json';

const BUNGIE_PLATFORM_BASE_URL = 'https://www.bungie.net/Platform';
const VAULT_SNAPSHOT_CACHE_KEY = 'bungie.vault-snapshot';
const STADIA_MEMBERSHIP_TYPE = 5;

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

function requestedComponentIds() {
    return Object.values(DESTINY_PROFILE_COMPONENTS);
}

function assertBungieSuccess<T>(payload: BungieResponse<T>, fallbackMessage: string) {
    if (payload.ErrorCode && payload.ErrorCode !== 1) {
        throw new Error(`${payload.ErrorStatus ?? fallbackMessage}: ${payload.Message ?? 'Unknown Bungie API error'}`);
    }
}

async function bungieFetch<T>(path: string, token: BungieToken) {
    const config = getBungieConfig();
    const response = await fetch(`${BUNGIE_PLATFORM_BASE_URL}${path}`, {
        headers: {
            Authorization: `Bearer ${token.accessToken}`,
            'X-API-Key': config.apiKey
        }
    });
    const payload = (await response.json().catch(() => null)) as BungieResponse<T> | null;

    if (!response.ok || !payload) {
        throw new Error(`Bungie request failed (${response.status})`);
    }

    assertBungieSuccess(payload, `Bungie request failed for ${path}`);
    return payload;
}

export async function fetchCurrentMemberships(token: BungieToken) {
    return bungieFetch<CurrentMembershipsPayload>('/User/GetMembershipsForCurrentUser/', token);
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
    const components = requestedComponentIds().join(',');
    const path = `/Destiny2/${membership.membershipType}/Profile/${membership.membershipId}/?components=${components}`;
    return bungieFetch<Record<string, unknown>>(path, token);
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
