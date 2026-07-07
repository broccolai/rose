import type { ArmorInventoryBySlot, ArmorItem, ArmorSlot, DestinyClass } from '@armor-calc';
import type {
    DestinyEquipableItemSetDefinition,
    DestinyInventoryItemDefinition,
    DestinyProfileResponse,
    DestinySandboxPerkDefinition,
    ServerResponse
} from 'bungie-api-ts/destiny2';
import type { UserMembershipData } from 'bungie-api-ts/user';

type SelectedDestinyMembership = UserMembershipData['destinyMemberships'][number] & {
    selectionReason?: string;
};

export type VaultExportSnapshot = {
    metadata?: {
        exportedAt?: string;
        [key: string]: unknown;
    };
    selectedMembership?: SelectedDestinyMembership;
    membershipsResponse?: ServerResponse<UserMembershipData>;
    profileResponse?: ServerResponse<DestinyProfileResponse>;
};

export type ManifestResolver = {
    getInventoryItem(hash: number): Promise<DestinyInventoryItemDefinition | null>;
    getEquipableItemSetDefinitions?(): LoadedManifestEquipableItemSetDefinition[];
    getSandboxPerk?(hash: number): Promise<DestinySandboxPerkDefinition | null>;
};

export type LoadedManifestDefinition = {
    hash: number;
    definition: DestinyInventoryItemDefinition;
};

export type LoadedManifestEquipableItemSetDefinition = {
    hash: number;
    definition: DestinyEquipableItemSetDefinition;
};

export type LoadedManifestResolver = ManifestResolver & {
    getLoadedInventoryItemDefinitions(): LoadedManifestDefinition[];
    getInventoryItemDefinitionsByPlugCategory?(plugCategoryIdentifier: string): LoadedManifestDefinition[];
    getManifestCacheMetadata?(): {
        version?: string;
        cachedAt?: string;
        definitionCount: number;
        equipableItemSetDefinitionCount?: number;
        sandboxPerkDefinitionCount?: number;
        fullCacheAvailable: boolean;
    };
};

export type NormalizedCharacter = {
    characterId: string;
    classType: DestinyClass;
    label: string;
    light?: number;
};

export type NormalizedArmorProfile = {
    characters: NormalizedCharacter[];
    armor: ArmorItem[];
    armorBySlot: ArmorInventoryBySlot;
    armorSetCatalog: ArmorSetCatalogEntry[];
    warnings: string[];
};

export type ArmorSetBonusInfo = {
    requiredPieces: number;
    sandboxPerkHash?: number;
    name: string;
    description?: string;
    iconUrl?: string;
};

export type ArmorSetCatalogEntry = {
    id: string;
    name: string;
    equipableItemSetHash: number;
    iconUrl?: string;
    itemHashes: number[];
    classTypes: DestinyClass[];
    slots: ArmorSlot[];
    bonuses: ArmorSetBonusInfo[];
};

export type NormalizeProgress = {
    label: string;
    current: number;
    total: number;
};

export type NormalizeVaultExportOptions = {
    onProgress?: (progress: NormalizeProgress) => void;
};
