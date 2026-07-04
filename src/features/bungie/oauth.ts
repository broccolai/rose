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
    raw: unknown;
};

type BungieTokenResponse = {
    access_token?: string;
    token_type?: string;
    expires_in?: number;
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
    const rawToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!rawToken) {
        return null;
    }

    try {
        const token = JSON.parse(rawToken) as BungieToken;
        if (!token.accessToken || !token.expiresAt || token.expiresAt <= Date.now() + EXPIRY_SKEW_MS) {
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

    const token: BungieToken = {
        accessToken: payload.access_token,
        tokenType: payload.token_type ?? 'Bearer',
        expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000,
        raw: payload
    };

    storeToken(token);
    return token;
}

export function getTokenDebugState() {
    const token = readToken();
    return token
        ? {
              authenticated: true,
              expiresAt: new Date(token.expiresAt).toISOString()
          }
        : {
              authenticated: false,
              expiresAt: null
          };
}
