import { getBungieConfig } from '@/features/bungie/config';

const OAUTH_STATE_STORAGE_KEY = 'rose.bungie.oauth.state';
const TOKEN_STORAGE_KEY = 'rose.bungie.oauth.token';
const TOKEN_ENDPOINT = 'https://www.bungie.net/Platform/App/OAuth/Token/';
const STATE_BYTE_LENGTH = 24;
const EXPIRY_SKEW_MS = 60_000;

export type BungieToken = {
    accessToken: string;
    tokenType: string;
    expiresAt: number;
    refreshToken?: string;
    refreshExpiresAt?: number;
    raw: unknown;
};

type BungieTokenResponse = {
    access_token?: string;
    token_type?: string;
    expires_in?: number;
    refresh_token?: string;
    refresh_expires_in?: number;
};

function randomState() {
    const bytes = crypto.getRandomValues(new Uint8Array(STATE_BYTE_LENGTH));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function createAuthorizationUrl() {
    const config = getBungieConfig();
    const state = randomState();
    sessionStorage.setItem(OAUTH_STATE_STORAGE_KEY, state);

    const url = new URL(config.authUrl);
    url.searchParams.set('client_id', config.clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('state', state);
    url.searchParams.set('redirect_uri', config.redirectUri);

    return url.toString();
}

export function takeStoredOAuthState() {
    const stored = sessionStorage.getItem(OAUTH_STATE_STORAGE_KEY);
    sessionStorage.removeItem(OAUTH_STATE_STORAGE_KEY);
    return stored;
}

export function readToken() {
    const token = readStoredToken();
    if (!token) {
        return null;
    }

    if (!token.accessToken || !token.expiresAt || token.expiresAt <= Date.now() + EXPIRY_SKEW_MS) {
        return null;
    }

    return token;
}

function readStoredToken() {
    const rawToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!rawToken) {
        return null;
    }

    try {
        const token = JSON.parse(rawToken) as BungieToken;
        if (
            (!token.accessToken || !token.expiresAt) &&
            (!token.refreshToken || !token.refreshExpiresAt || token.refreshExpiresAt <= Date.now() + EXPIRY_SKEW_MS)
        ) {
            clearToken();
            return null;
        }

        return token;
    } catch {
        clearToken();
        return null;
    }
}

export function storeToken(token: BungieToken) {
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(token));
}

export function clearToken() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export async function getValidToken() {
    const token = readToken();
    if (token) {
        return token;
    }

    const storedToken = readStoredToken();
    if (!storedToken?.refreshToken || !storedToken.refreshExpiresAt || storedToken.refreshExpiresAt <= Date.now() + EXPIRY_SKEW_MS) {
        clearToken();
        return null;
    }

    return refreshToken(storedToken);
}

export async function exchangeAuthorizationCode(code: string) {
    const config = getBungieConfig();
    const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: config.clientId
    });

    const response = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-API-Key': config.apiKey
        },
        body
    });
    const payload = (await response.json().catch(() => null)) as BungieTokenResponse | null;

    if (!response.ok || !payload?.access_token) {
        throw new Error(`Bungie token exchange failed (${response.status})`);
    }

    const token = tokenFromResponse(payload);

    storeToken(token);
    return token;
}

async function refreshToken(previousToken: BungieToken) {
    const config = getBungieConfig();
    const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: previousToken.refreshToken ?? '',
        client_id: config.clientId
    });

    const response = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-API-Key': config.apiKey
        },
        body
    });
    const payload = (await response.json().catch(() => null)) as BungieTokenResponse | null;

    if (!response.ok || !payload?.access_token) {
        clearToken();
        throw new Error(`Bungie token refresh failed (${response.status})`);
    }

    const token = tokenFromResponse(payload, previousToken);
    storeToken(token);
    return token;
}

function tokenFromResponse(payload: BungieTokenResponse, previousToken?: BungieToken): BungieToken {
    const now = Date.now();
    const refreshToken = payload.refresh_token ?? previousToken?.refreshToken;
    const refreshExpiresAt =
        payload.refresh_expires_in !== undefined
            ? now + payload.refresh_expires_in * 1000
            : previousToken && refreshToken === previousToken.refreshToken
              ? previousToken.refreshExpiresAt
              : undefined;

    return {
        accessToken: payload.access_token ?? previousToken?.accessToken ?? '',
        tokenType: payload.token_type ?? previousToken?.tokenType ?? 'Bearer',
        expiresAt: now + (payload.expires_in ?? 3600) * 1000,
        refreshToken,
        refreshExpiresAt,
        raw: payload
    };
}

export function getTokenDebugState() {
    const token = readStoredToken();
    const accessTokenActive = Boolean(token?.accessToken && token.expiresAt > Date.now() + EXPIRY_SKEW_MS);
    const refreshTokenActive = Boolean(
        token?.refreshToken && token.refreshExpiresAt && token.refreshExpiresAt > Date.now() + EXPIRY_SKEW_MS
    );

    return token
        ? {
              authenticated: accessTokenActive || refreshTokenActive,
              expiresAt: new Date(token.expiresAt).toISOString(),
              refreshExpiresAt: token.refreshExpiresAt ? new Date(token.refreshExpiresAt).toISOString() : null
          }
        : {
              authenticated: false,
              expiresAt: null,
              refreshExpiresAt: null
          };
}
