import type { DestinyInventoryItemDefinition } from 'bungie-api-ts/destiny2';

import { type CalculatorPreferences, sanitizeCalculatorPreferences } from '@/features/armor/calculator-preferences';
import type { LoadedManifestDefinition, NormalizedArmorProfile, VaultExportSnapshot } from '@/features/armor/types';

const DEBUG_EXPORT_APP = 'rose-debug-vault-export';

export interface ImportedDebugExport {
    normalizedProfile: NormalizedArmorProfile;
    vaultSnapshot: VaultExportSnapshot | null;
    loadedManifestDefinitions: LoadedManifestDefinition[];
    calculatorPreferences: CalculatorPreferences | null;
    exportedAt?: string | undefined;
}

export const parseDebugExport = (source: string): ImportedDebugExport => {
    let value: unknown;
    try {
        value = JSON.parse(source);
    } catch {
        throw new Error('Could not read the selected debug export JSON.');
    }

    if (!isRecord(value) || !isRecord(value['metadata']) || value['metadata']['app'] !== DEBUG_EXPORT_APP) {
        throw new Error('The selected file is not a Rose debug vault export.');
    }

    const normalizedProfile = value['normalizedProfile'];
    if (!isNormalizedArmorProfile(normalizedProfile)) {
        throw new Error('The debug export does not contain normalized armor data.');
    }

    return {
        normalizedProfile,
        vaultSnapshot: isRecord(value['vaultSnapshot']) ? (value['vaultSnapshot'] as VaultExportSnapshot) : null,
        loadedManifestDefinitions: readLoadedManifestDefinitions(value),
        calculatorPreferences: sanitizeCalculatorPreferences(value['calculator']),
        exportedAt: typeof value['metadata']['exportedAt'] === 'string' ? value['metadata']['exportedAt'] : undefined
    };
};

const readLoadedManifestDefinitions = (value: Record<string, unknown>): LoadedManifestDefinition[] => {
    const loadedDefinitions = value['loadedManifestDefinitions'];
    if (Array.isArray(loadedDefinitions)) {
        return loadedDefinitions.filter(isLoadedManifestDefinition);
    }

    const manifest = value['manifest'];
    if (!isRecord(manifest) || !isRecord(manifest['inventoryItemDefinitions'])) {
        return [];
    }

    return Object.entries(manifest['inventoryItemDefinitions']).flatMap(([rawHash, definition]) => {
        const hash = Number(rawHash);
        return Number.isFinite(hash) && isRecord(definition)
            ? [{ hash, definition: definition as unknown as DestinyInventoryItemDefinition }]
            : [];
    });
};

const isLoadedManifestDefinition = (value: unknown): value is LoadedManifestDefinition =>
    isRecord(value) && Number.isFinite(value['hash']) && isRecord(value['definition']);

const isNormalizedArmorProfile = (value: unknown): value is NormalizedArmorProfile =>
    isRecord(value) &&
    Array.isArray(value['characters']) &&
    Array.isArray(value['armor']) &&
    isRecord(value['armorBySlot']) &&
    Array.isArray(value['armorSetCatalog']) &&
    Array.isArray(value['warnings']);

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
