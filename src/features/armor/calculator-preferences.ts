import { ARMOR_STATS, type ArmorBuildSort, type ArmorStat, type StatVector } from '@armor-calc';

import { type AppTheme, sanitizeAppTheme } from '@/features/armor/app-theme';
import { type ArmorSetDisplayMode, DEFAULT_RESULT_SORT } from '@/features/armor/result-display';
import { isSubclassType, type SubclassType, sanitizeFragmentIds } from '@/features/armor/subclass-fragments';

export type SetSelectionValue = '0' | '2' | '4';

export const MAX_TWO_PIECE_SET_SELECTIONS = 2;

export type CalculatorPreferences = {
    appTheme?: AppTheme | undefined;
    selectedCharacterId?: string | undefined;
    selectedExoticItemHash?: string | undefined;
    armorSetDisplayMode?: ArmorSetDisplayMode | undefined;
    selectedSubclass?: SubclassType | undefined;
    selectedFragmentIds?: string[] | undefined;
    dumpStat?: ArmorStat | '' | undefined;
    allowBalancedTuning?: boolean | undefined;
    onlyFullyMasterworkedGear?: boolean | undefined;
    targets?: Partial<StatVector> | undefined;
    setSelections?: Record<string, SetSelectionValue> | undefined;
    resultSort?: ArmorBuildSort | undefined;
};

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const CALCULATOR_PREFERENCES_KEY = 'rose.calculator.preferences.v1';

export const EMPTY_STAT_TARGETS: StatVector = {
    health: 0,
    melee: 0,
    grenade: 0,
    super: 0,
    class: 0,
    weapons: 0
};

export function isArmorStat(value: string): value is ArmorStat {
    return (ARMOR_STATS as readonly string[]).includes(value);
}

export function clampTarget(value: number) {
    return Math.max(0, Math.min(200, Number.isFinite(value) ? Math.trunc(value) : 0));
}

export function readCalculatorPreferences(storage = getLocalStorage()): CalculatorPreferences | null {
    if (!storage) {
        return null;
    }

    const raw = storage.getItem(CALCULATOR_PREFERENCES_KEY);
    if (!raw) {
        return null;
    }

    try {
        return sanitizeCalculatorPreferences(JSON.parse(raw));
    } catch {
        return null;
    }
}

export function writeCalculatorPreferences(preferences: CalculatorPreferences, storage = getLocalStorage()) {
    storage?.setItem(CALCULATOR_PREFERENCES_KEY, JSON.stringify(preferences));
}

export function clearCalculatorPreferences(storage = getLocalStorage()) {
    storage?.removeItem(CALCULATOR_PREFERENCES_KEY);
}

export function mergeCalculatorPreferencesForStorage(
    previous: CalculatorPreferences | null,
    current: CalculatorPreferences,
    hasProfile: boolean
): CalculatorPreferences {
    if (hasProfile) {
        return current;
    }

    return {
        ...current,
        selectedCharacterId: current.selectedCharacterId || previous?.selectedCharacterId,
        selectedExoticItemHash: current.selectedExoticItemHash || previous?.selectedExoticItemHash
    };
}

export function sanitizeCalculatorPreferences(value: unknown): CalculatorPreferences | null {
    if (!value || typeof value !== 'object') {
        return null;
    }

    const candidate = value as CalculatorPreferences;
    return {
        appTheme: sanitizeAppTheme(candidate.appTheme),
        selectedCharacterId: typeof candidate.selectedCharacterId === 'string' ? candidate.selectedCharacterId : undefined,
        selectedExoticItemHash: typeof candidate.selectedExoticItemHash === 'string' ? candidate.selectedExoticItemHash : undefined,
        armorSetDisplayMode: sanitizeArmorSetDisplayMode(candidate.armorSetDisplayMode),
        selectedSubclass: sanitizeSubclassType(candidate.selectedSubclass),
        selectedFragmentIds: sanitizeFragmentIds(candidate.selectedFragmentIds, sanitizeSubclassType(candidate.selectedSubclass)),
        dumpStat: candidate.dumpStat && isArmorStat(candidate.dumpStat) ? candidate.dumpStat : '',
        allowBalancedTuning: candidate.allowBalancedTuning === true,
        onlyFullyMasterworkedGear: candidate.onlyFullyMasterworkedGear === true,
        targets: sanitizeTargets(candidate.targets),
        setSelections: sanitizeSetSelectionRecord(candidate.setSelections),
        resultSort: sanitizeResultSort(candidate.resultSort)
    };
}

export function sanitizeArmorSetDisplayMode(value: unknown): ArmorSetDisplayMode {
    return value === 'sources' ? 'sources' : 'sets';
}

export function sanitizeSubclassType(value: unknown): SubclassType {
    return typeof value === 'string' && isSubclassType(value) ? value : 'Prismatic';
}

export function sanitizeTargets(value: unknown): Partial<StatVector> {
    if (!value || typeof value !== 'object') {
        return {};
    }

    const targets = value as Partial<Record<ArmorStat, unknown>>;
    return Object.fromEntries(ARMOR_STATS.map((stat) => [stat, clampTarget(Number(targets[stat]) || 0)])) as Partial<StatVector>;
}

export function sanitizeSetSelectionRecord(value: unknown): Record<string, SetSelectionValue> {
    if (!value || typeof value !== 'object') {
        return {};
    }

    const selections: Record<string, SetSelectionValue> = {};
    for (const [setId, selection] of Object.entries(value as Record<string, unknown>)) {
        if (typeof setId === 'string' && (selection === '0' || selection === '2' || selection === '4')) {
            selections[setId] = selection;
        }
    }

    return limitSetSelections(selections);
}

export function applySetSelectionLimit(
    current: Record<string, SetSelectionValue>,
    setId: string,
    nextValue: SetSelectionValue
): Record<string, SetSelectionValue> {
    const next = { ...current };

    if (nextValue === '0') {
        delete next[setId];
        return limitSetSelections(next);
    }

    if (nextValue === '4') {
        return {
            [setId]: '4'
        };
    }

    delete next[setId];
    next[setId] = '2';
    return limitSetSelections(next);
}

export function limitSetSelections(selections: Record<string, SetSelectionValue>): Record<string, SetSelectionValue> {
    const selectedEntries = Object.entries(selections).filter(([, value]) => value === '2' || value === '4');
    const fourPieceSelection = [...selectedEntries].reverse().find(([, value]) => value === '4');
    if (fourPieceSelection) {
        return {
            [fourPieceSelection[0]]: '4'
        };
    }

    return Object.fromEntries(selectedEntries.filter(([, value]) => value === '2').slice(-MAX_TWO_PIECE_SET_SELECTIONS));
}

export function sanitizeResultSort(value: unknown): ArmorBuildSort {
    if (!value || typeof value !== 'object') {
        return DEFAULT_RESULT_SORT;
    }

    const candidate = value as Partial<ArmorBuildSort>;
    const rawKey = candidate.key;
    const key = rawKey === 'totalStats' || (typeof rawKey === 'string' && isArmorStat(rawKey)) ? rawKey : DEFAULT_RESULT_SORT.key;

    return {
        key,
        direction: candidate.direction === 'desc' ? 'desc' : 'asc'
    };
}

function getLocalStorage(): StorageLike | undefined {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
}
