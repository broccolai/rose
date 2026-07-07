import { describe, expect, test } from 'bun:test';

import { isBungieManifestContentUrl } from '@/features/armor/manifest';

describe('manifest HTTP helpers', () => {
    test('detects Bungie manifest content urls that must stay simple CORS requests', () => {
        expect(
            isBungieManifestContentUrl(
                new URL('https://www.bungie.net/common/destiny2_content/json/en/DestinyInventoryItemDefinition-test.json')
            )
        ).toBe(true);
    });

    test('does not treat platform API urls as manifest content urls', () => {
        expect(isBungieManifestContentUrl(new URL('https://www.bungie.net/Platform/Destiny2/Manifest/'))).toBe(false);
    });
});
