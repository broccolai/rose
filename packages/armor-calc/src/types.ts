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
    equipableItemSetHash?: number | undefined;
};

export type ArmorItem = {
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
    selectedExoticItemHash?: number | undefined;
    dumpStat?: ArmorStat | undefined;
    allowBalancedTuning?: boolean | undefined;
    statTargets: Partial<StatVector>;
    statBonuses?: Partial<StatVector> | undefined;
    setRequirements: ArmorSetRequirement[];
    armor: ArmorInventoryBySlot;
    /**
     * Maximum rich builds to retain and return. The solver still counts all valid
     * builds so callers can show "showing N of M" without materializing M builds.
     */
    maxResults?: number | undefined;
    /**
     * When provided, the retained build cap means "top N by this sort" across
     * every valid build, not "first N found by search order".
     */
    resultSort?: ArmorBuildSort | undefined;
    /**
     * Stop searching as soon as maxResults valid builds have been found. This is
     * useful for interactive UIs where responsiveness matters more than an exact
     * total count.
     */
    stopWhenResultLimitReached?: boolean | undefined;
};

export type ArmorStatTargetCapsInput = Omit<SolveArmorInput, 'maxResults' | 'resultSort'>;

export type BuildArmorPiece = {
    item: ArmorItem;
    statMod?: StatAdjustment | undefined;
    tuning?: StatAdjustment | undefined;
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

export type SolveArmorProgress = Extract<SolveArmorResult, { ok: true }>;

export interface SolveArmorOptions {
    progressBuildCount?: number | undefined;
    onProgress?: ((progress: SolveArmorProgress) => void) | undefined;
}
