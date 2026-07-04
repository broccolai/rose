import type {
    ArmorInventoryBySlot,
    ArmorItem,
    ArmorSetRequirement,
    ArmorSlot,
    ArmorStat,
    DestinyClass,
    StatVector
} from '../../armor-calc/src';

export type LoadedBenchmarkBundle = {
    normalizedProfile?: {
        characters?: Array<{
            characterId: string;
            classType: DestinyClass;
            label: string;
        }>;
        armor?: ArmorItem[];
    };
};

export type BenchmarkScenario = {
    id: string;
    name: string;
    classType: Exclude<DestinyClass, 'any'>;
    targets: Partial<StatVector>;
    selectedExoticItemHash?: number;
    setRequirements?: ArmorSetRequirement[];
    syntheticSets?: SyntheticArmorSet[];
    disableTuning?: boolean;
    maxResults?: number;
};

export type SyntheticArmorSet = {
    id: string;
    name: string;
    slots: readonly ArmorSlot[];
};

export type PreparedScenario = {
    scenario: BenchmarkScenario;
    selectedArmor: ArmorItem[];
    armorBySlot: ArmorInventoryBySlot;
    rawSlotProduct: number;
};

export type SolverBenchmarkResult = {
    ok: boolean;
    elapsedMs: number;
    searchedCombinations: number;
    returnedBuildCount: number;
    resultCount: number;
};

export type D2APBenchmarkResult = {
    elapsedMs: number;
    checkedCalculations: number;
    computedPermutations: number;
    savedResults: number;
    workerReportedMs: number;
};

export type ComparisonBenchmarkResult = {
    scenario: BenchmarkScenario;
    itemCount: number;
    rawSlotProduct: number;
    rose: SolverBenchmarkResult;
    d2ap: D2APBenchmarkResult;
};

export const d2apStatOrder: ArmorStat[] = ['weapons', 'health', 'class', 'grenade', 'super', 'melee'];
