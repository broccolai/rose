export const ARMOR_STATS = ['health', 'melee', 'grenade', 'super', 'class', 'weapons'] as const;
export const ARMOR_SLOTS = ['helmet', 'arms', 'chest', 'legs', 'classItem'] as const;

export type ArmorStat = (typeof ARMOR_STATS)[number];
export type ArmorSlot = (typeof ARMOR_SLOTS)[number];
export type DestinyClass = 'titan' | 'hunter' | 'warlock' | 'any';
export type ArmorCalculatorMode = 'owned' | 'planning';
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

export interface ArmorPerkInfo {
    hash: number;
    name: string;
    description?: string | undefined;
    iconUrl?: string | undefined;
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
    exoticClassItemPerks?: ArmorPerkInfo[] | undefined;
    exoticClassItemPerkKey?: string | undefined;
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
    selectedExoticClassItemPerkKey?: string | undefined;
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

export interface ArmorArchetype {
    id: string;
    name: string;
    primaryStat: ArmorStat;
    secondaryStat: ArmorStat;
}

export interface ArmorRollProfile {
    id: string;
    archetype: ArmorArchetype;
    tertiaryStat: ArmorStat;
    baseStats: StatVector;
    statModOptions: StatAdjustment[];
    tuningOptions: StatAdjustment[];
}

export interface PlanArmorInput {
    dumpStat?: ArmorStat | undefined;
    allowBalancedTuning?: boolean | undefined;
    statTargets: Partial<StatVector>;
    statBonuses?: Partial<StatVector> | undefined;
    maxResults?: number | undefined;
}

export type ArmorPlanStatCapsInput = Omit<PlanArmorInput, 'maxResults'>;

export interface PlannedArmorPiece {
    roll: ArmorRollProfile;
    statMod?: StatAdjustment | undefined;
    tuning?: StatAdjustment | undefined;
}

export interface ArmorPlan {
    pieces: Record<ArmorSlot, PlannedArmorPiece>;
    stats: StatVector;
    score: {
        wastedStats: number;
        totalStats: number;
    };
}

interface PlanArmorResultBase {
    validPlanCount: number;
    returnedPlanCount: number;
    resultLimitReached: boolean;
    searchedRollCombinations: number;
    rejectedRollCombinations: number;
}

export interface PlanArmorSuccess extends PlanArmorResultBase {
    ok: true;
    plans: ArmorPlan[];
}

export interface PlanArmorFailure extends PlanArmorResultBase {
    ok: false;
    reason: string;
}

export type PlanArmorResult = PlanArmorSuccess | PlanArmorFailure;
export type PlanArmorProgress = PlanArmorSuccess;

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
