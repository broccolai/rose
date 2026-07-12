export const ARMOR_STATS = ['health', 'melee', 'grenade', 'super', 'class', 'weapons'] as const;
export const ARMOR_SLOTS = ['helmet', 'arms', 'chest', 'legs', 'classItem'] as const;

export type ArmorStat = (typeof ARMOR_STATS)[number];
export type ArmorSlot = (typeof ARMOR_SLOTS)[number];
export type DestinyClass = 'titan' | 'hunter' | 'warlock' | 'any';
export type StatVector = Record<ArmorStat, number>;

export interface StatAdjustment {
    id: string;
    name: string;
    deltas: Partial<StatVector>;
}

export interface ArmorSetInfo {
    id: string;
    name: string;
    equipableItemSetHash?: number | undefined;
}

export interface ArmorItem {
    itemInstanceId: string;
    equivalentItemInstanceIds?: string[] | undefined;
    itemHash: number;
    name: string;
    iconUrl?: string | undefined;
    slot: ArmorSlot;
    classType: DestinyClass;
    isExotic: boolean;
    set?: ArmorSetInfo | undefined;
    tier?: 1 | 2 | 3 | 4 | 5 | undefined;
    isCurrentMasterworked?: boolean | undefined;
    fullyMasterworkedItemInstanceIds?: string[] | undefined;
    baseStats: StatVector;
    statModOptions: StatAdjustment[];
    tuningOptions: StatAdjustment[];
    debugWarnings?: string[] | undefined;
}

export type ArmorInventoryBySlot = Record<ArmorSlot, ArmorItem[]>;

export interface ArmorSetRequirement {
    setId: string;
    requiredPieces: 2 | 4;
}

export type ArmorBuildSortKey = ArmorStat | 'wastedStats' | 'totalStats';
export type ArmorBuildSortDirection = 'asc' | 'desc';

export interface ArmorBuildSort {
    key: ArmorBuildSortKey;
    direction: ArmorBuildSortDirection;
}

export interface SolveArmorInput {
    characterId: string;
    classType: DestinyClass;
    selectedExoticItemHash?: number | undefined;
    dumpStat?: ArmorStat | undefined;
    allowBalancedTuning?: boolean | undefined;
    statTargets: Partial<StatVector>;
    statBonuses?: Partial<StatVector> | undefined;
    setRequirements: ArmorSetRequirement[];
    armor: ArmorInventoryBySlot;
    /** Maximum rich builds to retain and return. */
    maxResults?: number | undefined;
    /** Retain the best builds across the complete search using this ordering. */
    resultSort?: ArmorBuildSort | undefined;
    /** Stop once the requested number of valid builds has been found. */
    stopWhenResultLimitReached?: boolean | undefined;
}

export type ArmorStatTargetCapsInput = Omit<SolveArmorInput, 'maxResults' | 'resultSort'>;

export interface BuildArmorPiece {
    item: ArmorItem;
    statMod?: StatAdjustment | undefined;
    tuning?: StatAdjustment | undefined;
}

export interface ActiveArmorSetBonus {
    setId: string;
    name: string;
    pieces: number;
    activeBonuses: Array<2 | 4>;
}

export interface ArmorBuild {
    pieces: Record<ArmorSlot, BuildArmorPiece>;
    stats: StatVector;
    activeSetBonuses: ActiveArmorSetBonus[];
    score: {
        wastedStats: number;
        totalStats: number;
    };
}

interface SolveArmorResultBase {
    validBuildCount: number;
    returnedBuildCount: number;
    resultLimitReached: boolean;
    searchedCombinations: number;
    rejectedCombinations: number;
    warnings: string[];
}

export interface SolveArmorSuccess extends SolveArmorResultBase {
    ok: true;
    builds: ArmorBuild[];
}

export interface SolveArmorFailure extends SolveArmorResultBase {
    ok: false;
    reason: string;
}

export type SolveArmorResult = SolveArmorSuccess | SolveArmorFailure;
export type SolveArmorProgress = SolveArmorSuccess;
