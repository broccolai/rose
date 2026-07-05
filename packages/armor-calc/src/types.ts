export const ARMOR_STATS = ['health', 'melee', 'grenade', 'super', 'class', 'weapons'] as const;
export const ARMOR_SLOTS = ['helmet', 'arms', 'chest', 'legs', 'classItem'] as const;

export type ArmorStat = (typeof ARMOR_STATS)[number];
export type ArmorSlot = (typeof ARMOR_SLOTS)[number];
export type DestinyClass = 'titan' | 'hunter' | 'warlock' | 'any';

export type StatVector = Record<ArmorStat, number>;

export type StatAdjustment = {
    id: string;
    name: string;
    deltas: Partial<StatVector>;
};

export type ArmorSetInfo = {
    id: string;
    name: string;
    equipableItemSetHash?: number;
};

export type ArmorItem = {
    itemInstanceId: string;
    equivalentItemInstanceIds?: string[];
    itemHash: number;
    name: string;
    iconUrl?: string;
    slot: ArmorSlot;
    classType: DestinyClass;
    isExotic: boolean;
    set?: ArmorSetInfo;
    tier?: 1 | 2 | 3 | 4 | 5;
    baseStats: StatVector;
    statModOptions: StatAdjustment[];
    tuningOptions: StatAdjustment[];
    debugWarnings?: string[];
};

export type ArmorInventoryBySlot = Record<ArmorSlot, ArmorItem[]>;

export type ArmorSetRequirement = {
    setId: string;
    requiredPieces: 2 | 4;
};

export type ArmorBuildSortKey = ArmorStat | 'wastedStats' | 'totalStats';
export type ArmorBuildSortDirection = 'asc' | 'desc';

export type ArmorBuildSort = {
    key: ArmorBuildSortKey;
    direction: ArmorBuildSortDirection;
};

export type SolveArmorInput = {
    characterId: string;
    classType: DestinyClass;
    selectedExoticItemHash?: number;
    dumpStat?: ArmorStat;
    allowBalancedTuning?: boolean;
    statTargets: Partial<StatVector>;
    setRequirements: ArmorSetRequirement[];
    armor: ArmorInventoryBySlot;
    /**
     * Maximum rich builds to retain and return. The solver still counts all valid
     * builds so callers can show "showing N of M" without materializing M builds.
     */
    maxResults?: number;
    /**
     * When provided, the retained build cap means "top N by this sort" across
     * every valid build, not "first N found by search order".
     */
    resultSort?: ArmorBuildSort;
};

export type ArmorStatTargetCapsInput = Omit<SolveArmorInput, 'maxResults' | 'resultSort'>;

export type BuildArmorPiece = {
    item: ArmorItem;
    statMod?: StatAdjustment;
    tuning?: StatAdjustment;
};

export type ActiveArmorSetBonus = {
    setId: string;
    name: string;
    pieces: number;
    activeBonuses: Array<2 | 4>;
};

export type ArmorBuild = {
    pieces: Record<ArmorSlot, BuildArmorPiece>;
    stats: StatVector;
    activeSetBonuses: ActiveArmorSetBonus[];
    score: {
        wastedStats: number;
        totalStats: number;
    };
};

export type SolveArmorResult =
    | {
          ok: true;
          builds: ArmorBuild[];
          validBuildCount: number;
          returnedBuildCount: number;
          resultLimitReached: boolean;
          searchedCombinations: number;
          rejectedCombinations: number;
          warnings: string[];
      }
    | {
          ok: false;
          reason: string;
          validBuildCount: number;
          returnedBuildCount: number;
          resultLimitReached: boolean;
          searchedCombinations: number;
          rejectedCombinations: number;
          warnings: string[];
      };
