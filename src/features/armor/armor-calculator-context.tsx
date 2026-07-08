import type { ArmorBuild, ArmorBuildSort, ArmorStat, SolveArmorResult, StatVector } from '@armor-calc';
import { type Accessor, createContext, type JSX, useContext } from 'solid-js';

import type { SetSelectionValue } from '@/features/armor/calculator-preferences';
import type { AvailableArmorSet, AvailableExotic, CharacterButtonOption, ResultSortKey } from '@/features/armor/calculator-view-model';
import type { LoadProgress } from '@/features/armor/components/app-toolbar';
import type { ArmorSetDisplayMode } from '@/features/armor/result-display';
import type { SubclassType } from '@/features/armor/subclass-fragments';

export interface ArmorCalculatorContextValue {
    controls: {
        characterOptions: Accessor<CharacterButtonOption[]>;
        selectedCharacterId: Accessor<string>;
        selectedExoticItemHash: Accessor<string>;
        armorSetDisplayMode: Accessor<ArmorSetDisplayMode>;
        selectedSubclass: Accessor<SubclassType>;
        selectedFragmentIds: Accessor<string[]>;
        importingFragments: Accessor<boolean>;
        dumpStat: Accessor<ArmorStat | ''>;
        allowBalancedTuning: Accessor<boolean>;
        onlyFullyMasterworkedGear: Accessor<boolean>;
        targets: Accessor<StatVector>;
        targetCaps: Accessor<StatVector>;
        targetCapsPending: Accessor<boolean>;
        setSelections: Accessor<Record<string, SetSelectionValue>>;
        availableExotics: Accessor<AvailableExotic[]>;
        selectableSets: Accessor<AvailableArmorSet[]>;
        canSolve: Accessor<boolean>;
        solving: Accessor<boolean>;
    };
    results: {
        result: Accessor<SolveArmorResult | null>;
        builds: Accessor<ArmorBuild[]>;
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
    };
    actions: {
        selectCharacter: (characterId: string) => void;
        selectExotic: (itemHash: string) => void;
        setArmorSetDisplayMode: (mode: ArmorSetDisplayMode) => void;
        setSubclass: (subclass: SubclassType) => void;
        toggleFragment: (fragmentId: string) => void;
        importFragmentsFromGame: () => void;
        setDumpStat: (stat: string) => void;
        setAllowBalancedTuning: (enabled: boolean) => void;
        setOnlyFullyMasterworkedGear: (enabled: boolean) => void;
        setTarget: (stat: ArmorStat, value: string) => void;
        setRequirement: (setId: string, value: string) => void;
        solve: () => void;
        clearChoices: () => void;
        setExpandedBuildKey: (key: string | null) => void;
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
