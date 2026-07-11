import { getBungieConfig } from '@/features/bungie/config';

const OAUTH_STATE_STORAGE_KEY = 'rose.bungie.oauth.state';
const TOKEN_STORAGE_KEY = 'rose.bungie.oauth.token';
const TOKEN_EXCHANGE_ENDPOINT = '/api/bungie/oauth/token';
const TOKEN_REFRESH_ENDPOINT = '/api/bungie/oauth/refresh';
const TOKEN_LOGOUT_ENDPOINT = '/api/bungie/oauth/logout';
const STATE_BYTE_LENGTH = 24;
const STATE_TTL_MS = 10 * 60 * 1000;
const EXPIRY_SKEW_MS = 60_000;

export type BungieToken = {
    accessToken: string;
    tokenType: string;
    expiresAt: number;
    refreshToken?: string | undefined;
    refreshAvailable?: boolean | undefined;
    refreshExpiresAt?: number | undefined;
    raw: unknown;
};

type BungieTokenResponse = {
    access_token?: string;
    token_type?: string;
    expires_in?: number;
    refresh_token?: string;
    refresh_available?: boolean;
    refresh_expires_in?: number;
    refresh_token_expires_in?: number;
};

type StoredOAuthState = {
    state: string;
    createdAt: number;
};

function randomState() {
    const bytes = crypto.getRandomValues(new Uint8Array(STATE_BYTE_LENGTH));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function createAuthorizationUrl() {
    const config = getBungieConfig();
    const state = randomState();
    storeOAuthState(state);

    const url = new URL(config.authUrl);
    url.searchParams.set('client_id', config.clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('state', state);
    url.searchParams.set('redirect_uri', config.redirectUri);

    return url.toString();
}

export function takeStoredOAuthState() {
    const stored = readStoredOAuthState(sessionStorage) ?? readStoredOAuthState(localStorage);
    sessionStorage.removeItem(OAUTH_STATE_STORAGE_KEY);
    localStorage.removeItem(OAUTH_STATE_STORAGE_KEY);
    return stored;
}

function storeOAuthState(state: string) {
    const payload = JSON.stringify({
        state,
        createdAt: Date.now()
    } satisfies StoredOAuthState);

    sessionStorage.setItem(OAUTH_STATE_STORAGE_KEY, payload);
    localStorage.setItem(OAUTH_STATE_STORAGE_KEY, payload);
}

function readStoredOAuthState(storage: Storage): string | null {
    const raw = storage.getItem(OAUTH_STATE_STORAGE_KEY);
    if (!raw) {
        return null;
    }

    try {
        const parsed = JSON.parse(raw) as Partial<StoredOAuthState>;
        if (!parsed.state || !parsed.createdAt || Date.now() - parsed.createdAt > STATE_TTL_MS) {
            return null;
        }

        return parsed.state;
    } catch {
        return raw;
    }
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
        if ((!token.accessToken || !token.expiresAt) && !canAttemptRefresh(token)) {
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

export async function logout(): Promise<void> {
    clearToken();
    await fetch(TOKEN_LOGOUT_ENDPOINT, {
        method: 'POST',
        credentials: 'same-origin'
    }).catch(() => undefined);
}

export async function getValidToken() {
    const token = readToken();
    if (token) {
        return token;
    }

    const storedToken = readStoredToken();
    if (!storedToken || !canAttemptRefresh(storedToken)) {
        clearToken();
        return null;
    }

    return refreshToken(storedToken);
}

export async function exchangeAuthorizationCode(code: string) {
    const config = getBungieConfig();
    const response = await fetch(TOKEN_EXCHANGE_ENDPOINT, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            code,
            redirectUri: config.redirectUri
        })
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
    const response = await fetch(TOKEN_REFRESH_ENDPOINT, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/json'
        }
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
    const refreshAvailable = payload.refresh_available ?? Boolean(refreshToken || previousToken?.refreshAvailable);
    const refreshExpiresIn = payload.refresh_expires_in ?? payload.refresh_token_expires_in;
    const refreshExpiresAt =
        refreshExpiresIn !== undefined
            ? now + refreshExpiresIn * 1000
            : previousToken && refreshToken === previousToken.refreshToken
              ? previousToken.refreshExpiresAt
              : undefined;

    return {
        accessToken: payload.access_token ?? previousToken?.accessToken ?? '',
        tokenType: payload.token_type ?? previousToken?.tokenType ?? 'Bearer',
        expiresAt: now + (payload.expires_in ?? 3600) * 1000,
        refreshToken,
        refreshAvailable,
        refreshExpiresAt,
        raw: payload
    };
}

function canAttemptRefresh(token: BungieToken) {
    return Boolean(
        (token.refreshToken || token.refreshAvailable) && (!token.refreshExpiresAt || token.refreshExpiresAt > Date.now() + EXPIRY_SKEW_MS)
    );
}

export function getTokenDebugState() {
    const token = readStoredToken();
    const accessTokenActive = Boolean(token?.accessToken && token.expiresAt > Date.now() + EXPIRY_SKEW_MS);
    const refreshTokenActive = Boolean(token && canAttemptRefresh(token));

    return token
        ? {
              authenticated: accessTokenActive || refreshTokenActive,
              hasRefreshToken: Boolean(token.refreshToken || token.refreshAvailable),
              expiresAt: new Date(token.expiresAt).toISOString(),
              refreshExpiresAt: token.refreshExpiresAt ? new Date(token.refreshExpiresAt).toISOString() : null
          }
        : {
              authenticated: false,
              hasRefreshToken: false,
              expiresAt: null,
              refreshExpiresAt: null
          };
}
