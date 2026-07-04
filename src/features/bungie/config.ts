export type BungieConfig = {
    apiKey: string;
    clientId: string;
    authUrl: string;
    redirectUri: string;
};

export function getBungieConfig(): BungieConfig {
    return {
        apiKey: import.meta.env.VITE_BUNGIE_API_KEY ?? '',
        clientId: import.meta.env.VITE_BUNGIE_CLIENT_ID ?? '',
        authUrl: import.meta.env.VITE_BUNGIE_AUTH_URL ?? 'https://www.bungie.net/en/OAuth/Authorize',
        redirectUri: import.meta.env.VITE_BUNGIE_REDIRECT_URI ?? `${window.location.origin}/auth/bungie/callback`
    };
}

export function getMissingConfigKeys(config = getBungieConfig()) {
    return [
        ['VITE_BUNGIE_API_KEY', config.apiKey],
        ['VITE_BUNGIE_CLIENT_ID', config.clientId],
        ['VITE_BUNGIE_AUTH_URL', config.authUrl],
        ['VITE_BUNGIE_REDIRECT_URI', config.redirectUri]
    ]
        .filter(([, value]) => !value)
        .map(([key]) => key);
}
