import type { DestinyInventoryItemDefinition } from 'bungie-api-ts/destiny2';

import { normalizeVaultExport } from '@/features/armor/normalize';
import type { LoadedManifestDefinition, NormalizedArmorProfile, VaultExportSnapshot } from '@/features/armor/types';

export interface LocalTestArmorBundle {
    vaultSnapshot?: VaultExportSnapshot;
    normalizedProfile?: NormalizedArmorProfile;
    loadedManifestDefinitions?: LoadedManifestDefinition[];
    manifest?: {
        inventoryItemDefinitions?: Record<string, DestinyInventoryItemDefinition>;
    };
}

export const readLocalTestManifestDefinitions = (bundle: LocalTestArmorBundle): LoadedManifestDefinition[] =>
    bundle.loadedManifestDefinitions ??
    Object.entries(bundle.manifest?.inventoryItemDefinitions ?? {}).map(([hash, definition]) => ({
        hash: Number(hash),
        definition
    }));

export async function hydrateExoticClassItemRolls(
    profile: NormalizedArmorProfile,
    snapshot: VaultExportSnapshot | null,
    loadedDefinitions: LoadedManifestDefinition[]
): Promise<NormalizedArmorProfile> {
    const needsHydration = profile.armor.some((item) => item.isExotic && item.slot === 'classItem' && !item.exoticClassItemPerkKey);
    if (!needsHydration || !snapshot || loadedDefinitions.length === 0) {
        return profile;
    }

    const definitions = new Map(loadedDefinitions.map(({ hash, definition }) => [hash, definition]));
    const hydrated = await normalizeVaultExport(snapshot, {
        async getInventoryItem(hash) {
            return definitions.get(hash) ?? null;
        }
    });

    if (hydrated.armor.length < profile.armor.length) {
        return profile;
    }

    return {
        ...hydrated,
        armorSetCatalog: profile.armorSetCatalog
    };
}
