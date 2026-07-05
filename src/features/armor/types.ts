import type { ArmorInventoryBySlot, ArmorItem, ArmorSlot, DestinyClass } from '@armor-calc';

export type VaultExportSnapshot = {
    metadata?: {
        exportedAt?: string;
        [key: string]: unknown;
    };
    selectedMembership?: unknown;
    membershipsResponse?: unknown;
    profileResponse?: {
        Response?: DestinyProfileResponse;
        [key: string]: unknown;
    };
};

export type DestinyProfileResponse = {
    profileInventory?: { data?: { items?: DestinyProfileItem[] } };
    characterInventories?: { data?: Record<string, { items?: DestinyProfileItem[] }> };
    characterEquipment?: { data?: Record<string, { items?: DestinyProfileItem[] }> };
    characters?: { data?: Record<string, DestinyCharacter> };
    itemComponents?: {
        stats?: { data?: Record<string, { stats?: Record<string, { value?: number }> }> };
        sockets?: { data?: Record<string, { sockets?: Array<{ plugHash?: number }> }> };
        reusablePlugs?: {
            data?: Record<
                string,
                {
                    plugs?: Record<string, Array<{ plugItemHash?: number; canInsert?: boolean; enabled?: boolean }>>;
                }
            >;
        };
        perks?: { data?: Record<string, { perks?: Array<{ perkHash?: number }> }> };
        instances?: {
            data?: Record<string, { primaryStat?: { value?: number }; quality?: number; gearTier?: number; [key: string]: unknown }>;
        };
        [key: string]: unknown;
    };
};

export type DestinyProfileItem = {
    itemHash: number;
    itemInstanceId?: string;
    bucketHash?: number;
    location?: number;
    transferStatus?: number;
    bindStatus?: number;
    [key: string]: unknown;
};

export type DestinyCharacter = {
    classType: number;
    light?: number;
    stats?: Record<string, number>;
    emblemHash?: number;
    [key: string]: unknown;
};

export type ManifestInventoryItemDefinition = {
    hash?: number;
    displayProperties?: {
        name?: string;
        description?: string;
        icon?: string;
    };
    itemType?: number;
    itemSubType?: number;
    classType?: number;
    itemCategoryHashes?: number[];
    inventory?: {
        bucketTypeHash?: number;
        tierType?: number;
        tierTypeName?: string;
    };
    equippingBlock?: {
        equipableItemSetHash?: number;
        [key: string]: unknown;
    };
    investmentStats?: Array<{
        statTypeHash: number;
        value: number;
    }>;
    sockets?: {
        socketEntries?: Array<{
            singleInitialItemHash?: number;
            reusablePlugItems?: Array<{ plugItemHash?: number }>;
            randomPlugSetHash?: number;
            reusablePlugSetHash?: number;
            socketTypeHash?: number;
        }>;
    };
    plug?: {
        plugCategoryIdentifier?: string;
        plugCategoryHash?: number;
    };
    perks?: Array<{
        perkHash?: number;
        requirementDisplayString?: string;
    }>;
    [key: string]: unknown;
};

export type ManifestEquipableItemSetDefinition = {
    hash?: number;
    displayProperties?: {
        name?: string;
        description?: string;
        icon?: string;
    };
    setItems?: number[];
    setPerks?: Array<{
        requiredSetCount?: number;
        sandboxPerkHash?: number;
    }>;
    redacted?: boolean;
    [key: string]: unknown;
};

export type ManifestSandboxPerkDefinition = {
    hash?: number;
    displayProperties?: {
        name?: string;
        description?: string;
        icon?: string;
    };
    [key: string]: unknown;
};

export type ManifestResponse<T> = {
    Response?: T;
    ErrorCode?: number;
    ErrorStatus?: string;
    Message?: string;
};

export type DestinyManifest = {
    version?: string;
    jsonWorldComponentContentPaths?: Record<string, Record<string, string>>;
    mobileWorldContentPaths?: Record<string, string>;
    [key: string]: unknown;
};

export type ManifestResolver = {
    getInventoryItem(hash: number): Promise<ManifestInventoryItemDefinition | null>;
    getEquipableItemSetDefinitions?(): LoadedManifestEquipableItemSetDefinition[];
    getSandboxPerk?(hash: number): Promise<ManifestSandboxPerkDefinition | null>;
};

export type LoadedManifestDefinition = {
    hash: number;
    definition: ManifestInventoryItemDefinition;
};

export type LoadedManifestEquipableItemSetDefinition = {
    hash: number;
    definition: ManifestEquipableItemSetDefinition;
};

export type LoadedManifestResolver = ManifestResolver & {
    getLoadedInventoryItemDefinitions(): LoadedManifestDefinition[];
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
