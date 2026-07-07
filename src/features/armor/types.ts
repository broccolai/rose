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
    selectionReason?: string | undefined;
};

export type VaultExportSnapshot = {
    metadata?:
        | {
              exportedAt?: string | undefined;
              [key: string]: unknown;
          }
        | undefined;
    selectedMembership?: SelectedDestinyMembership | undefined;
    membershipsResponse?: ServerResponse<UserMembershipData> | undefined;
    profileResponse?: ServerResponse<DestinyProfileResponse> | undefined;
};

export type ManifestResolver = {
    getInventoryItem(hash: number): Promise<DestinyInventoryItemDefinition | null>;
    getEquipableItemSetDefinitions?: (() => LoadedManifestEquipableItemSetDefinition[]) | undefined;
    getSandboxPerk?: ((hash: number) => Promise<DestinySandboxPerkDefinition | null>) | undefined;
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
    getInventoryItemDefinitionsByPlugCategory?: ((plugCategoryIdentifier: string) => LoadedManifestDefinition[]) | undefined;
    getManifestCacheMetadata?:
        | (() => {
              version?: string | undefined;
              cachedAt?: string | undefined;
              definitionCount: number;
              equipableItemSetDefinitionCount?: number | undefined;
              sandboxPerkDefinitionCount?: number | undefined;
              fullCacheAvailable: boolean;
          })
        | undefined;
};

export type NormalizedCharacter = {
    characterId: string;
    classType: DestinyClass;
    label: string;
    light?: number | undefined;
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
    sandboxPerkHash?: number | undefined;
    name: string;
    description?: string | undefined;
    iconUrl?: string | undefined;
};

export type ArmorSetCatalogEntry = {
    id: string;
    name: string;
    equipableItemSetHash: number;
    iconUrl?: string | undefined;
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
    onProgress?: ((progress: NormalizeProgress) => void) | undefined;
};
