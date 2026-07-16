import type {
    ArmorInventoryBySlot,
    ArmorItem,
    ArmorSetRequirement,
    ArmorSlot,
    ArmorStat,
    DestinyClass,
    StatVector
} from '@rose/armor-domain';

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
    dumpStat?: ArmorStat;
    allowBalancedTuning?: boolean;
    statBonuses?: Partial<StatVector>;
    setRequirements?: ArmorSetRequirement[];
    syntheticSets?: SyntheticArmorSet[];
    synthesizeModernOptions?: boolean;
    syntheticTuningItemsPerSlot?: number;
    disableTuning?: boolean;
    maxResults?: number;
};

export type SliderBenchmarkStep = {
    stat: ArmorStat;
    value: number;
};

export type InteractiveBenchmarkScenario = BenchmarkScenario & {
    benchmarkTier?: 'standard' | 'stress';
    priorityStat: ArmorStat;
    sliderSteps: SliderBenchmarkStep[];
    sliderStepMode?: 'cumulative' | 'independent';
};

export type SyntheticArmorSet = {
    id: string;
    name: string;
    slots: readonly ArmorSlot[];
    itemsPerSlot?: number;
};

export type PreparedScenario = {
    scenario: BenchmarkScenario;
    selectedArmor: ArmorItem[];
    armorBySlot: ArmorInventoryBySlot;
    rawSlotProduct: number;
    tunableItemCount: number;
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

export type TimingDistribution = {
    samplesMs: number[];
    minMs: number;
    medianMs: number;
    meanMs: number;
    p95Ms: number;
    maxMs: number;
};

export type MeasuredWorkload<T> = {
    coldMs: number;
    coldValue: T;
    warm: TimingDistribution;
    warmValues: T[];
};

export type SliderRefreshResult = {
    priorityCap: number;
    caps: StatVector;
    clamped: boolean;
};

export type SliderSequenceResult = {
    steps: Array<SliderBenchmarkStep & SliderRefreshResult & { elapsedMs: number }>;
    finalTargets: StatVector;
};

export type SolveWorkloadResult = {
    ok: boolean;
    firstResultsMs: number | null;
    searchedCombinations: number;
    returnedBuildCount: number;
    validBuildCount: number;
};

export type InteractiveBenchmarkResult = {
    scenario: InteractiveBenchmarkScenario;
    itemCount: number;
    rawSlotProduct: number;
    tunableItemCount: number;
    singleSlider: MeasuredWorkload<number>;
    combinedSliders: MeasuredWorkload<StatVector>;
    uiSliderRefresh: MeasuredWorkload<SliderRefreshResult>;
    sliderSequence: MeasuredWorkload<SliderSequenceResult>;
    solve: MeasuredWorkload<SolveWorkloadResult>;
};

export type BenchmarkRunOptions = {
    iterations?: number | undefined;
    warmupIterations?: number | undefined;
};

export const d2apStatOrder: ArmorStat[] = ['weapons', 'health', 'class', 'grenade', 'super', 'melee'];
