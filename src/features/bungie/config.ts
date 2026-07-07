export type BungieConfig = {
    apiKey: string;
    clientId: string;
    authUrl: string;
    redirectUri: string;
};

export const getBungieConfig = (): BungieConfig => ({
    apiKey: import.meta.env['VITE_BUNGIE_API_KEY'] ?? '',
    clientId: import.meta.env['VITE_BUNGIE_CLIENT_ID'] ?? '',
    authUrl: import.meta.env['VITE_BUNGIE_AUTH_URL'] ?? 'https://www.bungie.net/en/OAuth/Authorize',
    redirectUri: import.meta.env['VITE_BUNGIE_REDIRECT_URI'] ?? `${window.location.origin}/auth/bungie/callback`
});

export const getMissingConfigKeys = (config = getBungieConfig()): string[] =>
    [
        ['VITE_BUNGIE_API_KEY', config.apiKey],
        ['VITE_BUNGIE_CLIENT_ID', config.clientId],
        ['VITE_BUNGIE_AUTH_URL', config.authUrl]
    ]
        .filter(([, value]) => !value)
        .map(([key]) => key);
