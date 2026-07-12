import type {
    ArmorBuild,
    ArmorBuildSort,
    ArmorCalculatorMode,
    ArmorPlan,
    ArmorSlot,
    ArmorStat,
    PlanArmorResult,
    SolveArmorResult,
    StatVector
} from '@armor-domain';
import { type Accessor, createContext, type JSX, useContext } from 'solid-js';

import type { SetSelectionValue } from '@/features/armor/calculator-preferences';
import type { AvailableArmorSet, AvailableExotic, CharacterButtonOption, ResultSortKey } from '@/features/armor/calculator-view-model';
import type { LoadProgress } from '@/features/armor/components/app-toolbar';
import type { PlanningSlotRequirement } from '@/features/armor/model/armor-planning';
import type { SavedArmorBuild } from '@/features/armor/model/personal-library';
import type { ArmorSetDisplayMode } from '@/features/armor/result-display';
import type { FragmentDescriptionMap, SubclassType } from '@/features/armor/subclass-fragments';

export type ResultsView = 'results' | 'history';

export interface ArmorCalculatorContextValue {
    controls: {
        mode: Accessor<ArmorCalculatorMode>;
        characterOptions: Accessor<CharacterButtonOption[]>;
        selectedCharacterId: Accessor<string>;
        selectedExoticItemHash: Accessor<string>;
        armorSetDisplayMode: Accessor<ArmorSetDisplayMode>;
        selectedSubclass: Accessor<SubclassType>;
        selectedFragmentIds: Accessor<string[]>;
        fragmentDescriptions: Accessor<FragmentDescriptionMap>;
        importingFragments: Accessor<boolean>;
        dumpStat: Accessor<ArmorStat | ''>;
        allowBalancedTuning: Accessor<boolean>;
        onlyFullyMasterworkedGear: Accessor<boolean>;
        refreshVaultOnStartup: Accessor<boolean>;
        targets: Accessor<StatVector>;
        targetCaps: Accessor<StatVector>;
        targetCapsPending: Accessor<boolean>;
        setSelections: Accessor<Record<string, SetSelectionValue>>;
        otherSetsCollapsed: Accessor<boolean>;
        availableExotics: Accessor<AvailableExotic[]>;
        favoriteExoticItemHashes: Accessor<number[]>;
        selectableSets: Accessor<AvailableArmorSet[]>;
        canSolve: Accessor<boolean>;
        solving: Accessor<boolean>;
    };
    results: {
        mode: Accessor<ArmorCalculatorMode>;
        result: Accessor<SolveArmorResult | null>;
        builds: Accessor<ArmorBuild[]>;
        planResult: Accessor<PlanArmorResult | null>;
        plans: Accessor<ArmorPlan[]>;
        planningSlots: Accessor<Record<ArmorSlot, PlanningSlotRequirement> | null>;
        armorSets: Accessor<AvailableArmorSet[]>;
        armorSetDisplayMode: Accessor<ArmorSetDisplayMode>;
        resultFailure: Accessor<string | null>;
        sort: Accessor<ArmorBuildSort>;
        dumpStat: Accessor<ArmorStat | ''>;
        loading: Accessor<boolean>;
        progress: Accessor<LoadProgress>;
        showTuningResults: Accessor<boolean>;
        visibleLimit: Accessor<number>;
        expandedBuildKey: Accessor<string | null>;
        savedBuilds: Accessor<SavedArmorBuild[]>;
        view: Accessor<ResultsView>;
        isBuildSaved: (build: ArmorBuild) => boolean;
    };
    actions: {
        setMode: (mode: ArmorCalculatorMode) => void;
        selectCharacter: (characterId: string) => void;
        selectExotic: (itemHash: string) => void;
        toggleFavoriteExotic: (itemHash: number) => void;
        setArmorSetDisplayMode: (mode: ArmorSetDisplayMode) => void;
        setSubclass: (subclass: SubclassType) => void;
        toggleFragment: (fragmentId: string) => void;
        importFragmentsFromGame: () => void;
        setDumpStat: (stat: string) => void;
        setAllowBalancedTuning: (enabled: boolean) => void;
        setOnlyFullyMasterworkedGear: (enabled: boolean) => void;
        setRefreshVaultOnStartup: (enabled: boolean) => void;
        setTarget: (stat: ArmorStat, value: string) => void;
        setRequirement: (setId: string, value: string) => void;
        setOtherSetsCollapsed: (collapsed: boolean) => void;
        solve: () => void;
        clearChoices: () => void;
        setExpandedBuildKey: (key: string | null) => void;
        setResultsView: (view: ResultsView) => void;
        toggleSavedBuild: (build: ArmorBuild) => void;
        equipBuild: (build: ArmorBuild) => Promise<void>;
        sortResults: (key: ResultSortKey) => void;
    };
}

const ArmorCalculatorContext = createContext<ArmorCalculatorContextValue>();

interface ArmorCalculatorProviderProps {
    value: ArmorCalculatorContextValue;
    children: JSX.Element;
}

export function ArmorCalculatorProvider(props: ArmorCalculatorProviderProps): JSX.Element {
    return <ArmorCalculatorContext.Provider value={props.value}>{props.children}</ArmorCalculatorContext.Provider>;
}

export function useArmorCalculator(): ArmorCalculatorContextValue {
    const value = useContext(ArmorCalculatorContext);
    if (!value) {
        throw new Error('useArmorCalculator must be used inside ArmorCalculatorProvider.');
    }

    return value;
}
