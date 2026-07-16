import type { WeaponCatalog } from '@rose/weapon-model';

export {
    calculateManifestStats,
    createDefaultSelection,
    plugHashesForSocket,
    reconcileSelection,
    selectedPlugHashes,
    transformWeaponStatValue
} from '@rose/weapon-model';

const CATALOG_PATH = '/data/weapon-catalog.json';

let catalogPromise: Promise<WeaponCatalog> | undefined;

export const loadWeaponCatalog = (): Promise<WeaponCatalog> => {
    catalogPromise ??= fetch(CATALOG_PATH)
        .then(async (response) => {
            if (!response.ok) {
                throw new Error(`Weapon catalog failed to load (${response.status}).`);
            }

            const catalog = (await response.json()) as WeaponCatalog;
            if (
                catalog.schemaVersion !== 1 ||
                !Array.isArray(catalog.weapons) ||
                !Array.isArray(catalog.plugSets) ||
                !catalog.statGroups ||
                typeof catalog.statGroups !== 'object'
            ) {
                throw new Error('Weapon catalog schema is not supported.');
            }

            return catalog;
        })
        .catch((error: unknown) => {
            catalogPromise = undefined;
            throw error;
        });

    return catalogPromise;
};

export const bungieAssetUrl = (path: string): string => (path ? `https://www.bungie.net${path}` : '');
