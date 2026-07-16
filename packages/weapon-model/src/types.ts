export type WeaponAmmoType = 'primary' | 'special' | 'heavy' | 'unknown';

export type WeaponElement = 'kinetic' | 'arc' | 'solar' | 'void' | 'stasis' | 'strand' | 'unknown';

export type WeaponSlot = 'kinetic' | 'energy' | 'power' | 'unknown';

export type WeaponRarity = 'common' | 'uncommon' | 'rare' | 'legendary' | 'exotic' | 'unknown';

export type WeaponStat = {
    hash: number;
    name: string;
    value: number;
    maximum: number;
};

export type WeaponPlug = {
    hash: number;
    name: string;
    description: string;
    icon: string;
    category: string;
    label: string;
    enhanced: boolean;
    stats: Record<string, number>;
};

export type WeaponSocket = {
    index: number;
    label: string;
    category: string;
    initialPlugHash: number | null;
    plugSet: number;
};

export type WeaponDefinition = {
    hash: number;
    name: string;
    description: string;
    flavorText: string;
    icon: string;
    watermark: string;
    screenshot: string;
    type: string;
    subtype: number;
    element: WeaponElement;
    ammo: WeaponAmmoType;
    slot: WeaponSlot;
    rarity: WeaponRarity;
    source: string;
    seasonHash: number | null;
    statGroupHash: number | null;
    intrinsicHash: number | null;
    intrinsicName: string;
    adept: boolean;
    craftable: boolean;
    investmentStats?: Record<string, number>;
    stats: WeaponStat[];
    sockets: WeaponSocket[];
};

export type WeaponStatGroup = {
    maximumValue: number;
    scaledStats: Record<
        string,
        {
            maximumValue: number;
            displayInterpolation: Array<[investmentValue: number, displayValue: number]>;
        }
    >;
};

export type WeaponCatalog = {
    schemaVersion: 1;
    manifestVersion: string;
    generatedAt: string;
    weapons: WeaponDefinition[];
    plugs: Record<string, WeaponPlug>;
    plugSets: number[][];
    statGroups: Record<string, WeaponStatGroup>;
};

export type WeaponMode = 'pvp' | 'pve';

export type WeaponScenario = {
    mode: WeaponMode;
    targetHealth: number;
    overshield: number;
    weaponsStat: number;
};

export type WeaponSelection = {
    weaponHash: number;
    plugs: Record<string, number>;
    effects: Record<string, number>;
};

export type WeaponFilterState = {
    query: string;
};

export type WeaponEffectOption = {
    stacks: [number, number];
    options: string[];
    optionType: 'STATIC' | 'TOGGLE' | 'SLIDER' | 'OPTIONS';
    modelingNote?: string;
};

export type WeaponCalculatedStat = WeaponStat & {
    baseValue: number;
    partValue: number;
    traitValue: number;
    total: number;
};

export type WeaponTtkKill = {
    timeTaken: number;
    bodyshots: number;
    headshots?: number;
};

export type WeaponTtkSummary = {
    targetHealth: number;
    overshield: number;
    damageScalar: number;
    bodyTtk: WeaponTtkKill | null;
    optimalTtk: WeaponTtkKill | null;
};

export type WeaponEngineCalculation = {
    coverage: 'full' | 'partial' | 'unavailable';
    engineVersion: string;
    unsupportedTraitHashes: number[];
    partiallyModeledTraitHashes: number[];
    effectOptions: Record<string, WeaponEffectOption>;
    stats: WeaponCalculatedStat[];
    range: {
        hipStart: number;
        hipEnd: number;
        adsStart: number;
        adsEnd: number;
        floorPercent: number;
    } | null;
    handling: {
        ready: number;
        stow: number;
        ads: number;
    } | null;
    reload: {
        reload: number;
        ammo: number;
    } | null;
    ammo: {
        magazine: number;
        reserves: number;
    } | null;
    firing: {
        bodyDamage: number;
        critDamage: number;
        rpm: number;
        burstSize: number;
    } | null;
    ttk: WeaponTtkSummary | null;
};

export type SavedWeaponRoll = {
    id: string;
    selection: WeaponSelection;
    weaponName: string;
    icon: string;
    subtitle: string;
    perkNames: string[];
    stats: Record<string, number>;
    optimalTtk: number | null;
    range: number | null;
    scenario: WeaponScenario;
    engineVersion: string;
    savedAt: number;
};
