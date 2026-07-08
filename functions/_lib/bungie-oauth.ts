const TOKEN_ENDPOINT = 'https://www.bungie.net/Platform/App/OAuth/Token/';
const REFRESH_COOKIE_NAME = 'rose_bungie_refresh';

interface BungieOAuthEnv {
    BUNGIE_CLIENT_ID?: string | undefined;
    BUNGIE_CLIENT_SECRET?: string | undefined;
    VITE_BUNGIE_API_KEY?: string | undefined;
    VITE_BUNGIE_CLIENT_ID?: string | undefined;
}

interface TokenExchangeRequest {
    code?: string | undefined;
    redirectUri?: string | undefined;
}

interface BungieTokenPayload {
    access_token?: string | undefined;
    token_type?: string | undefined;
    expires_in?: number | undefined;
    refresh_token?: string | undefined;
    refresh_expires_in?: number | undefined;
    refresh_token_expires_in?: number | undefined;
    membership_id?: string | undefined;
}

type PublicTokenPayload = Omit<BungieTokenPayload, 'refresh_token'> & {
    refresh_available: boolean;
};

export interface PagesFunctionContext {
    request: Request;
    env: BungieOAuthEnv;
}

export async function handleTokenExchange(context: PagesFunctionContext): Promise<Response> {
    const body = await readJson<TokenExchangeRequest>(context.request);
    if (!body?.code || !body.redirectUri) {
        return json({ error: 'Missing OAuth code or redirect URI.' }, 400);
    }

    return exchangeWithBungie(context.env, {
        grant_type: 'authorization_code',
        code: body.code,
        redirect_uri: body.redirectUri
    });
}

export async function handleTokenRefresh(context: PagesFunctionContext): Promise<Response> {
    const refreshToken = readCookie(context.request.headers.get('Cookie'), REFRESH_COOKIE_NAME);
    if (!refreshToken) {
        return json({ error: 'No refresh token cookie is available.' }, 401, clearRefreshCookieHeaders());
    }

    return exchangeWithBungie(context.env, {
        grant_type: 'refresh_token',
        refresh_token: refreshToken
    });
}

async function exchangeWithBungie(env: BungieOAuthEnv, params: Record<string, string>): Promise<Response> {
    const config = readOAuthConfig(env);
    if (!config.ok) {
        return json({ error: config.error }, 500);
    }

    const body = new URLSearchParams({
        ...params,
        client_id: config.clientId,
        client_secret: config.clientSecret
    });

    const response = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-API-Key': config.apiKey
        },
        body
    });
    const payload = (await response.json().catch(() => null)) as BungieTokenPayload | null;

    if (!response.ok || !payload?.access_token) {
        return json(
            {
                error: `Bungie OAuth request failed (${response.status}).`
            },
            response.ok ? 502 : response.status,
            clearRefreshCookieHeaders()
        );
    }

    const headers = new Headers();
    const refreshToken = payload.refresh_token;
    if (refreshToken) {
        headers.append('Set-Cookie', serializeRefreshCookie(refreshToken, readRefreshExpiresIn(payload)));
    }

    return json(publicTokenPayload(payload, Boolean(refreshToken) || params['grant_type'] === 'refresh_token'), 200, headers);
}

function readOAuthConfig(
    env: BungieOAuthEnv
): { ok: true; apiKey: string; clientId: string; clientSecret: string } | { ok: false; error: string } {
    const apiKey = env.VITE_BUNGIE_API_KEY;
    const clientId = env.BUNGIE_CLIENT_ID ?? env.VITE_BUNGIE_CLIENT_ID;
    const clientSecret = env.BUNGIE_CLIENT_SECRET;
    const missing: string[] = [];

    if (!apiKey) {
        missing.push('VITE_BUNGIE_API_KEY');
    }
    if (!clientId) {
        missing.push('VITE_BUNGIE_CLIENT_ID or BUNGIE_CLIENT_ID');
    }
    if (!clientSecret) {
        missing.push('BUNGIE_CLIENT_SECRET');
    }

    if (!apiKey || !clientId || !clientSecret) {
        return {
            ok: false,
            error: `Missing Cloudflare env: ${missing.join(', ')}`
        };
    }

    return {
        ok: true,
        apiKey,
        clientId,
        clientSecret
    };
}

async function readJson<T>(request: Request): Promise<T | null> {
    try {
        return (await request.json()) as T;
    } catch {
        return null;
    }
}

function publicTokenPayload(payload: BungieTokenPayload, refreshAvailable: boolean): PublicTokenPayload {
    const { refresh_token: _refreshToken, ...publicPayload } = payload;

    return {
        ...publicPayload,
        refresh_available: refreshAvailable
    };
}

function readRefreshExpiresIn(payload: BungieTokenPayload): number | undefined {
    return payload.refresh_expires_in ?? payload.refresh_token_expires_in;
}

function json(payload: unknown, status: number, extraHeaders?: Headers): Response {
    const headers = new Headers(extraHeaders);
    headers.set('Content-Type', 'application/json; charset=utf-8');
    headers.set('Cache-Control', 'no-store');

    return new Response(JSON.stringify(payload), {
        status,
        headers
    });
}

function serializeRefreshCookie(refreshToken: string, maxAgeSeconds?: number): string {
    return [
        `${REFRESH_COOKIE_NAME}=${encodeURIComponent(refreshToken)}`,
        'Path=/api/bungie/oauth',
        'HttpOnly',
        'Secure',
        'SameSite=Lax',
        maxAgeSeconds !== undefined ? `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}` : null
    ]
        .filter(Boolean)
        .join('; ');
}

function clearRefreshCookieHeaders(): Headers {
    const headers = new Headers();
    headers.append('Set-Cookie', `${REFRESH_COOKIE_NAME}=; Path=/api/bungie/oauth; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);

    return headers;
}

function readCookie(cookieHeader: string | null, name: string): string | null {
    if (!cookieHeader) {
        return null;
    }

    for (const part of cookieHeader.split(';')) {
        const [rawName, ...valueParts] = part.trim().split('=');
        if (rawName === name) {
            return decodeURIComponent(valueParts.join('='));
        }
    }

    return null;
}
