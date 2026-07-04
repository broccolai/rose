import {
    ARMOR_SLOTS,
    ARMOR_STATS,
    type ArmorBuild,
    type ArmorBuildSort,
    type ArmorSetRequirement,
    type ArmorStat,
    type DestinyClass,
    type SolveArmorResult,
    type StatVector,
    solveArmor
} from '@armor-calc';
import { css } from '@panda/css';
import { createEffect, createMemo, createSignal, For, onMount, Show } from 'solid-js';

import { createBungieManifestResolver } from '@/features/armor/manifest';
import { getArmorForClass, getAvailableArmorSets, makeArmorBySlotForClass, normalizeVaultExport } from '@/features/armor/normalize';
import { buildExpansionKey, COMPACT_STAT_LABELS, DEFAULT_RESULT_SORT, formatArmorBonusSummary } from '@/features/armor/result-display';
import type { LoadedManifestDefinition, NormalizedArmorProfile, VaultExportSnapshot } from '@/features/armor/types';
import { downloadJsonFile, exportVaultSnapshot, readCachedVaultSnapshot } from '@/features/bungie/api';
import { getMissingConfigKeys } from '@/features/bungie/config';
import { clearToken, createAuthorizationUrl, getTokenDebugState, readToken } from '@/features/bungie/oauth';

type Status = 'idle' | 'loading' | 'solving' | 'exporting' | 'error' | 'done';

type LoadProgress = {
    active: boolean;
    label: string;
    current: number;
    total: number;
    percent: number;
};

type ResultSortKey = ArmorBuildSort['key'];
type SetSelectionValue = '0' | '2' | '4';
type CharacterButtonClass = Extract<DestinyClass, 'hunter' | 'warlock' | 'titan'>;

type CalculatorPreferences = {
    selectedCharacterId?: string;
    selectedExoticItemHash?: string;
    dumpStat?: ArmorStat | '';
    allowBalancedTuning?: boolean;
    targets?: Partial<StatVector>;
    setSelections?: Record<string, SetSelectionValue>;
    resultSort?: ArmorBuildSort;
};

const SOLVER_RESULT_POOL_LIMIT = 30_000;
const VISIBLE_RESULT_LIMIT = 25;
const CALCULATOR_PREFERENCES_KEY = 'rose.calculator.preferences.v1';
const CHARACTER_BUTTON_CLASSES: CharacterButtonClass[] = ['hunter', 'warlock', 'titan'];
const CHARACTER_BUTTON_COLORS: Record<CharacterButtonClass, string> = {
    hunter: '#c86f2d',
    warlock: '#7256d8',
    titan: '#2e7bbf'
};
const emptyTargets: StatVector = {
    health: 0,
    melee: 0,
    grenade: 0,
    super: 0,
    class: 0,
    weapons: 0
};

const statLabels: Record<ArmorStat, string> = {
    health: 'Health',
    melee: 'Melee',
    grenade: 'Grenade',
    super: 'Super',
    class: 'Class',
    weapons: 'Weapons'
};

const slotLabels = {
    helmet: 'Helmet',
    arms: 'Arms',
    chest: 'Chest',
    legs: 'Legs',
    classItem: 'Class Item'
};

const page = css({
    minH: '100vh',
    p: { base: '12px', md: '18px' },
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1120px)',
    gridAutoRows: 'max-content',
    justifyContent: 'center',
    gap: '6px',
    alignItems: 'start',
    alignContent: 'start',
    boxSizing: 'border-box'
});

const panel = css({
    w: '100%',
    minW: 0,
    boxSizing: 'border-box',
    bg: 'panel',
    border: '1px solid token(colors.line)',
    borderRadius: '8px',
    p: { base: '12px', md: '16px' },
    boxShadow: '0 20px 50px rgba(22, 24, 29, 0.08)'
});

const title = css({
    m: 0,
    fontSize: { base: '22px', md: '28px' },
    lineHeight: 1.08,
    fontWeight: 700
});

const titleMuted = css({
    color: 'muted',
    fontWeight: 650
});

const titleProduct = css({
    letterSpacing: '0.08em'
});

const muted = css({
    color: 'muted',
    lineHeight: 1.55
});

const row = css({
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px'
});

const grid = css({
    display: 'grid',
    gridTemplateColumns: { base: 'minmax(0, 1fr)', lg: '320px minmax(0, 1fr)' },
    gap: '12px',
    w: '100%',
    minW: 0,
    alignItems: 'start'
});

const topPanel = css({
    display: 'grid',
    gap: '8px'
});

const topBar = css({
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '12px'
});

const headingGroup = css({
    display: 'grid',
    gap: '4px'
});

const controlGrid = css({
    display: 'grid',
    gap: '12px'
});

const field = css({
    display: 'grid',
    gap: '6px'
});

const checkboxField = css({
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    fontWeight: 700,
    color: 'ink'
});

const label = css({
    fontSize: '13px',
    fontWeight: 700,
    color: 'ink'
});

const input = css({
    w: '100%',
    minW: 0,
    boxSizing: 'border-box',
    minH: '38px',
    border: '1px solid token(colors.line)',
    borderRadius: '6px',
    bg: 'white',
    px: '10px',
    color: 'ink'
});

const statGrid = css({
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '10px'
});

const characterButtonGrid = css({
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '8px'
});

const characterButton = css({
    minH: '38px',
    border: '1px solid transparent',
    borderRadius: '6px',
    bg: 'var(--class-color)',
    color: 'white',
    fontWeight: 800,
    fontSize: '15px',
    boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.2)',
    opacity: 0.86,
    _hover: {
        opacity: 1
    },
    _disabled: {
        opacity: 0.3,
        cursor: 'not-allowed'
    },
    '&[data-selected="true"]': {
        opacity: 1,
        outline: '2px solid token(colors.ink)',
        outlineOffset: '2px'
    }
});

const button = css({
    minH: '34px',
    px: '12px',
    border: '1px solid transparent',
    borderRadius: '6px',
    bg: 'accent',
    color: 'white',
    fontSize: '13px',
    fontWeight: 650,
    _disabled: {
        opacity: 0.55,
        cursor: 'not-allowed'
    }
});

const secondaryButton = css({
    minH: '34px',
    px: '12px',
    border: '1px solid token(colors.line)',
    borderRadius: '6px',
    bg: 'paper',
    color: 'ink',
    fontSize: '13px',
    fontWeight: 650,
    _disabled: {
        opacity: 0.55,
        cursor: 'not-allowed'
    }
});

const progressWrap = css({
    display: 'grid',
    gap: '8px'
});

const progressTrack = css({
    h: '10px',
    overflow: 'hidden',
    borderRadius: '999px',
    bg: 'paper',
    border: '1px solid token(colors.line)'
});

const progressBar = css({
    h: '100%',
    bg: 'accent',
    transition: 'width 180ms ease'
});

const progressMeta = css({
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    color: 'muted',
    fontSize: '12px'
});

const resultsHeader = css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    mb: '12px'
});

const tableWrap = css({
    w: '100%',
    maxW: '100%',
    minW: 0,
    overflowX: 'auto',
    border: '1px solid token(colors.line)',
    borderRadius: '8px',
    bg: 'white'
});

const tinyMuted = css({
    color: 'muted',
    fontSize: '12px',
    lineHeight: 1.4
});

const sortButton = css({
    border: 0,
    bg: 'transparent',
    color: 'inherit',
    font: 'inherit',
    fontWeight: 700,
    p: 0,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '2px',
    w: '100%'
});

const table = css({
    w: '100%',
    minW: '720px',
    tableLayout: 'fixed',
    borderCollapse: 'collapse',
    fontSize: '12px',
    '& th': {
        textAlign: 'left',
        borderBottom: '1px solid token(colors.line)',
        p: '6px 8px',
        color: 'muted',
        whiteSpace: 'nowrap',
        lineHeight: 1.2
    },
    '& td': {
        borderBottom: '1px solid token(colors.line)',
        p: '6px 8px',
        verticalAlign: 'middle',
        lineHeight: 1.2,
        h: '38px'
    },
    '& th[data-numeric], & td[data-numeric]': {
        textAlign: 'right',
        fontVariantNumeric: 'tabular-nums'
    },
    '& td[data-text-cell]': {
        overflowWrap: 'anywhere',
        wordBreak: 'normal'
    },
    '& tr[data-clickable="true"]': {
        cursor: 'pointer'
    },
    '& tr[data-expanded="true"]': {
        bg: '#eef3ff'
    },
    '& tbody tr:nth-child(even)': {
        bg: 'paper'
    },
    '& tbody tr:hover': {
        bg: '#f3f6ff'
    }
});

const expandCell = css({
    p: '0 !important',
    h: 'auto !important',
    bg: '#fbfcff'
});

const detailPanel = css({
    display: 'grid',
    gap: '10px',
    p: '10px 12px 12px'
});

const detailGrid = css({
    display: 'grid',
    gridTemplateColumns: {
        base: '68px minmax(0, 1fr) minmax(90px, 130px)',
        md: '86px minmax(220px, 1fr) minmax(120px, 170px) minmax(150px, 190px)'
    },
    gap: '1px',
    overflow: 'hidden',
    border: '1px solid token(colors.line)',
    borderRadius: '6px',
    bg: 'line',
    fontSize: '12px',
    '& > div': {
        bg: 'white',
        px: '8px',
        py: '6px',
        minW: 0
    },
    '&[data-tuning="false"]': {
        gridTemplateColumns: {
            base: '68px minmax(0, 1fr) minmax(90px, 130px)',
            md: '86px minmax(220px, 1fr) minmax(120px, 180px)'
        }
    }
});

const detailHeader = css({
    color: 'muted',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0',
    fontSize: '11px'
});

const truncateText = css({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
});

const bonusText = css({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: 'ink'
});

function isArmorStat(value: string): value is ArmorStat {
    return (ARMOR_STATS as readonly string[]).includes(value);
}

function readCalculatorPreferences(): CalculatorPreferences | null {
    if (typeof localStorage === 'undefined') {
        return null;
    }

    const raw = localStorage.getItem(CALCULATOR_PREFERENCES_KEY);
    if (!raw) {
        return null;
    }

    try {
        return sanitizeCalculatorPreferences(JSON.parse(raw));
    } catch {
        return null;
    }
}

function writeCalculatorPreferences(preferences: CalculatorPreferences) {
    if (typeof localStorage === 'undefined') {
        return;
    }

    localStorage.setItem(CALCULATOR_PREFERENCES_KEY, JSON.stringify(preferences));
}

function clearCalculatorPreferences() {
    if (typeof localStorage === 'undefined') {
        return;
    }

    localStorage.removeItem(CALCULATOR_PREFERENCES_KEY);
}

function mergeCalculatorPreferencesForStorage(
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

function sanitizeCalculatorPreferences(value: unknown): CalculatorPreferences | null {
    if (!value || typeof value !== 'object') {
        return null;
    }

    const candidate = value as CalculatorPreferences;
    return {
        selectedCharacterId: typeof candidate.selectedCharacterId === 'string' ? candidate.selectedCharacterId : undefined,
        selectedExoticItemHash: typeof candidate.selectedExoticItemHash === 'string' ? candidate.selectedExoticItemHash : undefined,
        dumpStat: candidate.dumpStat && isArmorStat(candidate.dumpStat) ? candidate.dumpStat : '',
        allowBalancedTuning: candidate.allowBalancedTuning === true,
        targets: sanitizeTargets(candidate.targets),
        setSelections: sanitizeSetSelectionRecord(candidate.setSelections),
        resultSort: sanitizeResultSort(candidate.resultSort)
    };
}

function sanitizeTargets(value: unknown): Partial<StatVector> {
    if (!value || typeof value !== 'object') {
        return {};
    }

    const targets = value as Partial<Record<ArmorStat, unknown>>;
    return Object.fromEntries(ARMOR_STATS.map((stat) => [stat, clampTarget(Number(targets[stat]) || 0)])) as Partial<StatVector>;
}

function sanitizeSetSelectionRecord(value: unknown): Record<string, SetSelectionValue> {
    if (!value || typeof value !== 'object') {
        return {};
    }

    const selections: Record<string, SetSelectionValue> = {};
    for (const [setId, selection] of Object.entries(value as Record<string, unknown>)) {
        if (typeof setId === 'string' && (selection === '0' || selection === '2' || selection === '4')) {
            selections[setId] = selection;
        }
    }

    return selections;
}

function sanitizeResultSort(value: unknown): ArmorBuildSort {
    if (!value || typeof value !== 'object') {
        return DEFAULT_RESULT_SORT;
    }

    const candidate = value as Partial<ArmorBuildSort>;
    const rawKey = candidate.key;
    const key: ResultSortKey =
        rawKey === 'totalStats' || (typeof rawKey === 'string' && isArmorStat(rawKey)) ? rawKey : DEFAULT_RESULT_SORT.key;

    return {
        key,
        direction: candidate.direction === 'desc' ? 'desc' : 'asc'
    };
}

function clampTarget(value: number) {
    return Math.max(0, Math.min(200, Number.isFinite(value) ? Math.trunc(value) : 0));
}

export default function Home() {
    const [status, setStatus] = createSignal<Status>('idle');
    const [_message, setMessage] = createSignal('Checking local token...');
    const [authenticated, setAuthenticated] = createSignal(false);
    const [loadProgress, setLoadProgress] = createSignal<LoadProgress>({
        active: false,
        label: '',
        current: 0,
        total: 0,
        percent: 0
    });
    const [normalizedProfile, setNormalizedProfile] = createSignal<NormalizedArmorProfile | null>(null);
    const [loadedSnapshot, setLoadedSnapshot] = createSignal<VaultExportSnapshot | null>(null);
    const [loadedManifestDefinitions, setLoadedManifestDefinitions] = createSignal<LoadedManifestDefinition[]>([]);
    const [selectedCharacterId, setSelectedCharacterId] = createSignal('');
    const [selectedExoticItemHash, setSelectedExoticItemHash] = createSignal('');
    const [dumpStat, setDumpStat] = createSignal<ArmorStat | ''>('');
    const [allowBalancedTuning, setAllowBalancedTuning] = createSignal(false);
    const [targets, setTargets] = createSignal<StatVector>({ ...emptyTargets });
    const [setSelections, setSetSelections] = createSignal<Record<string, SetSelectionValue>>({});
    const [resultSort, setResultSort] = createSignal<ArmorBuildSort>(DEFAULT_RESULT_SORT);
    const [solveResult, setSolveResult] = createSignal<SolveArmorResult | null>(null);
    const [expandedBuildKey, setExpandedBuildKey] = createSignal<string | null>(null);
    const [preferencesLoaded, setPreferencesLoaded] = createSignal(false);
    let exoticSelect: HTMLSelectElement | undefined;

    const selectedCharacter = createMemo(() => {
        const profile = normalizedProfile();
        return profile?.characters.find((character) => character.characterId === selectedCharacterId()) ?? profile?.characters[0] ?? null;
    });

    const characterButtons = createMemo(() => {
        const characters = normalizedProfile()?.characters ?? [];
        return CHARACTER_BUTTON_CLASSES.map((classType) => ({
            classType,
            character: characters.find((character) => character.classType === classType) ?? null
        }));
    });

    const compatibleArmor = createMemo(() => {
        const profile = normalizedProfile();
        const character = selectedCharacter();
        return profile && character ? getArmorForClass(profile.armor, character.classType) : [];
    });

    const availableExotics = createMemo(() => {
        const exoticsByHash = new Map<number, { itemHash: number; name: string; slot: (typeof ARMOR_SLOTS)[number]; count: number }>();

        for (const item of compatibleArmor().filter((armorItem) => armorItem.isExotic)) {
            const current = exoticsByHash.get(item.itemHash);
            exoticsByHash.set(item.itemHash, {
                itemHash: item.itemHash,
                name: item.name,
                slot: item.slot,
                count: (current?.count ?? 0) + 1
            });
        }

        return [...exoticsByHash.values()].sort((left, right) => left.name.localeCompare(right.name));
    });
    const availableSets = createMemo(() => {
        const profile = normalizedProfile();
        const character = selectedCharacter();
        return profile && character ? getAvailableArmorSets(profile.armor, character.classType) : [];
    });
    const selectableSets = createMemo(() => availableSets().filter((set) => set.count >= 2));
    const resultBuilds = createMemo(() => {
        const result = solveResult();
        if (!result?.ok) {
            return [];
        }

        return [...result.builds].sort(compareVisibleBuilds);
    });
    const visibleResultBuilds = createMemo(() => resultBuilds().slice(0, VISIBLE_RESULT_LIMIT));
    const resultFailure = createMemo(() => {
        const result = solveResult();
        return result && !result.ok ? result.reason : null;
    });
    const showTuningResults = createMemo(() => Boolean(dumpStat()));

    const selectedSetRequirements = createMemo<ArmorSetRequirement[]>(() =>
        selectableSets()
            .map((set) => ({
                setId: set.id,
                requiredPieces: Number(setSelections()[set.id] ?? '0') as 0 | 2 | 4
            }))
            .filter((set): set is ArmorSetRequirement => set.requiredPieces === 2 || set.requiredPieces === 4)
    );

    function compareVisibleBuilds(left: ArmorBuild, right: ArmorBuild) {
        const sort = resultSort();
        const direction = sort.direction === 'asc' ? 1 : -1;
        const primary = resultSortValue(left, sort.key) - resultSortValue(right, sort.key);

        return primary * direction || left.score.wastedStats - right.score.wastedStats || right.score.totalStats - left.score.totalStats;
    }

    function resultSortValue(build: ArmorBuild, key: ResultSortKey) {
        if (key === 'wastedStats') {
            return build.score.wastedStats;
        }

        if (key === 'totalStats') {
            return build.score.totalStats;
        }

        return build.stats[key];
    }

    function toggleResultSort(key: ResultSortKey) {
        const nextSort: ArmorBuildSort = {
            key,
            direction: resultSort().key === key && resultSort().direction === 'asc' ? 'desc' : 'asc'
        };

        setResultSort(nextSort);
    }

    function toggleExpandedBuild(build: ArmorBuild) {
        const key = buildExpansionKey(build);
        setExpandedBuildKey((current) => (current === key ? null : key));
    }

    function selectCharacter(characterId: string) {
        setSelectedCharacterId(characterId);
        setSelectedExoticItemHash('');
        setSetSelections({});
        setSolveResult(null);
        setExpandedBuildKey(null);
    }

    function sortMark(key: ResultSortKey) {
        const sort = resultSort();
        if (sort.key !== key) {
            return '';
        }

        return sort.direction === 'asc' ? ' asc' : ' desc';
    }

    function formatAddonName(build: ArmorBuild, slot: (typeof ARMOR_SLOTS)[number], addonKey: 'statMod' | 'tuning') {
        const addon = build.pieces[slot][addonKey];
        return addon && ARMOR_STATS.some((stat) => (addon.deltas[stat] ?? 0) !== 0) ? addon.name : '-';
    }

    function refreshAuthState() {
        const debugState = getTokenDebugState();
        setAuthenticated(debugState.authenticated);
        setMessage(debugState.authenticated ? `Signed in. Token expires at ${debugState.expiresAt}.` : 'Signed out.');
    }

    onMount(() => {
        refreshAuthState();
        applyCalculatorPreferences(readCalculatorPreferences());
        setPreferencesLoaded(true);
    });

    createEffect(() => {
        if (!preferencesLoaded()) {
            return;
        }

        const currentPreferences = {
            selectedCharacterId: selectedCharacterId(),
            selectedExoticItemHash: selectedExoticItemHash(),
            dumpStat: dumpStat(),
            allowBalancedTuning: allowBalancedTuning(),
            targets: targets(),
            setSelections: setSelections(),
            resultSort: resultSort()
        };

        writeCalculatorPreferences(
            mergeCalculatorPreferencesForStorage(readCalculatorPreferences(), currentPreferences, Boolean(normalizedProfile()))
        );
    });

    createEffect(() => {
        const selectedHash = selectedExoticItemHash();
        availableExotics();

        if (exoticSelect && exoticSelect.value !== selectedHash) {
            exoticSelect.value = selectedHash;
        }
    });

    function signIn() {
        const missingKeys = getMissingConfigKeys();
        if (missingKeys.length > 0) {
            setStatus('error');
            setMessage(`Missing config: ${missingKeys.join(', ')}`);
            return;
        }

        window.location.href = createAuthorizationUrl();
    }

    function signOut() {
        clearToken();
        setStatus('idle');
        setLoadProgress({ active: false, label: '', current: 0, total: 0, percent: 0 });
        setNormalizedProfile(null);
        setLoadedSnapshot(null);
        setLoadedManifestDefinitions([]);
        setSolveResult(null);
        setExpandedBuildKey(null);
        refreshAuthState();
    }

    async function loadCalculatorData() {
        const token = readToken();
        if (!token) {
            setAuthenticated(false);
            setStatus('error');
            setMessage('Missing or expired token. Sign in again.');
            return;
        }

        try {
            setStatus('loading');
            setMessage('Fetching profile from Bungie, then checking local manifest cache...');
            setLoadProgress({
                active: true,
                label: 'Fetching Bungie profile',
                current: 0,
                total: 0,
                percent: 8
            });
            const nextSnapshot = (await exportVaultSnapshot(token)) as VaultExportSnapshot;
            await applyLoadedCalculatorData(nextSnapshot, 'Bungie refresh');
        } catch (error) {
            setStatus('error');
            setLoadProgress({ active: false, label: '', current: 0, total: 0, percent: 0 });
            setMessage(error instanceof Error ? error.message : 'Unknown calculator load failure.');
        }
    }

    async function loadCachedCalculatorData() {
        try {
            setStatus('loading');
            setMessage('Loading cached profile and checking local manifest cache...');
            setLoadProgress({
                active: true,
                label: 'Reading cached profile',
                current: 0,
                total: 0,
                percent: 5
            });
            const cachedSnapshot = await readCachedVaultSnapshot();

            if (!cachedSnapshot) {
                setStatus('error');
                setLoadProgress({ active: false, label: '', current: 0, total: 0, percent: 0 });
                setMessage('No cached profile found yet. Refresh from Bungie once first.');
                return;
            }

            await applyLoadedCalculatorData(cachedSnapshot as VaultExportSnapshot, 'cached profile');
        } catch (error) {
            setStatus('error');
            setLoadProgress({ active: false, label: '', current: 0, total: 0, percent: 0 });
            setMessage(error instanceof Error ? error.message : 'Unknown cached calculator load failure.');
        }
    }

    async function applyLoadedCalculatorData(nextSnapshot: VaultExportSnapshot, sourceLabel: string) {
        setLoadedSnapshot(null);
        setLoadedManifestDefinitions([]);
        setSolveResult(null);
        setExpandedBuildKey(null);

        const manifest = await createBungieManifestResolver({
            onStatus: (label) => {
                setLoadProgress({
                    active: true,
                    label,
                    current: 0,
                    total: 0,
                    percent: 10
                });
            }
        });
        const manifestMetadata = manifest.getManifestCacheMetadata?.();

        setLoadProgress({
            active: true,
            label: 'Preparing manifest resolver',
            current: 0,
            total: 0,
            percent: 12
        });
        const nextProfile = await normalizeVaultExport(nextSnapshot, manifest, {
            onProgress: (progress) => {
                const ratio = progress.total > 0 ? progress.current / progress.total : 0;
                setLoadProgress({
                    active: true,
                    label: progress.label,
                    current: progress.current,
                    total: progress.total,
                    percent: Math.max(12, Math.min(98, Math.round(12 + ratio * 86)))
                });
            }
        });
        const savedPreferences = readCalculatorPreferences();
        const desiredCharacterId = selectedCharacterId() || savedPreferences?.selectedCharacterId || '';
        const desiredExoticItemHash = selectedExoticItemHash() || savedPreferences?.selectedExoticItemHash || '';
        const selectedCharacter =
            nextProfile.characters.find((character) => character.characterId === desiredCharacterId) ?? nextProfile.characters[0];
        const nextCharacterId = selectedCharacter?.characterId ?? '';
        const nextCharacterClass = selectedCharacter?.classType ?? 'any';

        setNormalizedProfile(nextProfile);
        setLoadedSnapshot(nextSnapshot);
        setLoadedManifestDefinitions(manifest.getLoadedInventoryItemDefinitions());
        setSelectedCharacterId(nextCharacterId);
        setSelectedExoticItemHash(reconcileSelectedExotic(nextProfile, nextCharacterClass, desiredExoticItemHash));
        setSetSelections(reconcileSetSelections(nextProfile, nextCharacterClass, setSelections()));
        setStatus('done');
        setLoadProgress({
            active: false,
            label: 'Done',
            current: nextProfile.armor.length,
            total: nextProfile.armor.length,
            percent: 100
        });
        setMessage(
            [
                `Loaded ${nextProfile.armor.length} current armor candidate pieces for ${nextProfile.characters.length} characters from ${sourceLabel}.`,
                `Manifest cache: ${manifestMetadata?.fullCacheAvailable ? 'ready' : 'partial'}${manifestMetadata?.version ? ` (${manifestMetadata.version})` : ''}.`,
                `Loaded manifest definitions used by this profile: ${manifest.getLoadedInventoryItemDefinitions().length}.`,
                `Warnings: ${nextProfile.warnings.length}`
            ].join('\n')
        );
    }

    function downloadVaultJson() {
        const currentSnapshot = loadedSnapshot();
        const currentProfile = normalizedProfile();
        const currentDefinitions = loadedManifestDefinitions();
        if (!currentSnapshot || !currentProfile) {
            setStatus('error');
            setMessage('Load calculator data first, then download the already-fetched benchmark bundle.');
            return;
        }

        downloadJsonFile(
            {
                metadata: {
                    app: 'rose-loaded-benchmark-bundle',
                    exportVersion: 1,
                    exportedAt: new Date().toISOString(),
                    rawProfileExportedAt: currentSnapshot.metadata?.exportedAt,
                    normalizedArmorCount: currentProfile.armor.length,
                    manifestInventoryItemDefinitionCount: currentDefinitions.length
                },
                vaultSnapshot: currentSnapshot,
                normalizedProfile: currentProfile,
                manifest: {
                    inventoryItemDefinitions: Object.fromEntries(
                        currentDefinitions.map(({ hash, definition }) => [String(hash), definition])
                    )
                }
            },
            'rose-loaded-benchmark-bundle'
        );
        setStatus('done');
        setMessage(`Already-fetched benchmark bundle downloaded with ${currentDefinitions.length} manifest definitions.`);
    }

    function downloadManifestJson() {
        const currentDefinitions = loadedManifestDefinitions();
        if (currentDefinitions.length === 0) {
            setStatus('error');
            setMessage('Load calculator data first, then download the already-fetched manifest definitions.');
            return;
        }

        downloadJsonFile(
            {
                metadata: {
                    app: 'rose-manifest-inventory-item-definitions',
                    exportVersion: 1,
                    exportedAt: new Date().toISOString(),
                    manifestInventoryItemDefinitionCount: currentDefinitions.length
                },
                inventoryItemDefinitions: Object.fromEntries(currentDefinitions.map(({ hash, definition }) => [String(hash), definition]))
            },
            'rose-manifest-inventory-item-definitions'
        );
        setStatus('done');
        setMessage(`Manifest definitions downloaded with ${currentDefinitions.length} inventory item definitions.`);
    }

    function solveCurrentBuilds() {
        const profile = normalizedProfile();
        const character = selectedCharacter();

        if (!profile || !character) {
            setStatus('error');
            setMessage('Load calculator data before solving.');
            return;
        }

        setStatus('solving');
        setExpandedBuildKey(null);
        const result = solveArmor({
            characterId: character.characterId,
            classType: character.classType,
            selectedExoticItemHash: selectedExoticItemHash() ? Number(selectedExoticItemHash()) : undefined,
            dumpStat: dumpStat() || undefined,
            allowBalancedTuning: allowBalancedTuning(),
            statTargets: targets(),
            setRequirements: selectedSetRequirements(),
            armor: makeArmorBySlotForClass(profile.armor, character.classType),
            maxResults: SOLVER_RESULT_POOL_LIMIT
        });

        setSolveResult(result);
        setStatus(result.ok ? 'done' : 'error');
        setMessage(
            result.ok
                ? [
                      `Found ${result.validBuildCount} builds. Retained ${result.returnedBuildCount}. Showing ${Math.min(VISIBLE_RESULT_LIMIT, result.returnedBuildCount)}.`,
                      result.resultLimitReached ? 'Result pool hit the 30k cap; table sorting applies to retained builds.' : null,
                      `Searched ${result.searchedCombinations} armor combinations.`
                  ]
                      .filter(Boolean)
                      .join(' ')
                : `${result.reason}\nSearched ${result.searchedCombinations} armor combinations.`
        );
    }

    function updateTarget(stat: ArmorStat, value: string) {
        const numericValue = clampTarget(Number(value) || 0);
        setTargets((current) => ({
            ...current,
            [stat]: numericValue
        }));
    }

    function updateDumpStat(value: string) {
        const nextDumpStat = isArmorStat(value) ? value : '';
        setDumpStat(nextDumpStat);
        setSolveResult(null);
        setExpandedBuildKey(null);

        if (nextDumpStat) {
            setTargets((current) => ({
                ...current,
                [nextDumpStat]: 0
            }));
        }
    }

    function updateSetRequirement(setId: string, value: string) {
        setSetSelections((current) => ({
            ...current,
            [setId]: value === '2' || value === '4' ? value : '0'
        }));
        setSolveResult(null);
        setExpandedBuildKey(null);
    }

    function applyCalculatorPreferences(preferences: CalculatorPreferences | null) {
        if (!preferences) {
            return;
        }

        const nextDumpStat = preferences.dumpStat && isArmorStat(preferences.dumpStat) ? preferences.dumpStat : '';
        const nextTargets = { ...emptyTargets, ...sanitizeTargets(preferences.targets) };
        if (nextDumpStat) {
            nextTargets[nextDumpStat] = 0;
        }

        setSelectedCharacterId(preferences.selectedCharacterId ?? '');
        setSelectedExoticItemHash(preferences.selectedExoticItemHash ?? '');
        setDumpStat(nextDumpStat);
        setAllowBalancedTuning(preferences.allowBalancedTuning === true);
        setTargets(nextTargets);
        setSetSelections(preferences.setSelections ?? {});
        setResultSort(preferences.resultSort ?? DEFAULT_RESULT_SORT);
    }

    function clearSavedCalculatorChoices() {
        clearCalculatorPreferences();
        setSelectedCharacterId(normalizedProfile()?.characters[0]?.characterId ?? '');
        setSelectedExoticItemHash('');
        setDumpStat('');
        setAllowBalancedTuning(false);
        setTargets({ ...emptyTargets });
        setSetSelections({});
        setResultSort(DEFAULT_RESULT_SORT);
        setSolveResult(null);
        setExpandedBuildKey(null);
        setStatus('idle');
        setMessage('Calculator choices cleared.');
    }

    function reconcileSelectedExotic(profile: NormalizedArmorProfile, classType: DestinyClass, selectedItemHash: string) {
        if (!selectedItemHash) {
            return '';
        }

        const selectedHash = Number(selectedItemHash);
        const hasCompatibleExotic = getArmorForClass(profile.armor, classType).some(
            (item) => item.isExotic && item.itemHash === selectedHash
        );

        return hasCompatibleExotic ? selectedItemHash : '';
    }

    function reconcileSetSelections(
        profile: NormalizedArmorProfile,
        classType: DestinyClass,
        selections: Record<string, SetSelectionValue>
    ) {
        const availableById = new Map(getAvailableArmorSets(profile.armor, classType).map((set) => [set.id, set]));
        const nextSelections: Record<string, SetSelectionValue> = {};

        for (const [setId, selection] of Object.entries(selections)) {
            const set = availableById.get(setId);
            if (!set || set.count < 2) {
                continue;
            }

            nextSelections[setId] = selection === '4' && set.count < 4 ? '2' : selection;
        }

        return nextSelections;
    }

    return (
        <main class={page}>
            <section class={`${panel} ${topPanel}`}>
                <div class={topBar}>
                    <div class={headingGroup}>
                        <h1 class={title}>
                            <span class={titleMuted}>rose/</span>
                            <span class={titleProduct}>ARMOR</span>
                        </h1>
                    </div>

                    <div class={row}>
                        <button class={button} type="button" onClick={signIn}>
                            Sign in
                        </button>
                        <button
                            class={button}
                            type="button"
                            onClick={loadCalculatorData}
                            disabled={!authenticated() || status() === 'loading'}
                        >
                            Refresh
                        </button>
                        <button class={secondaryButton} type="button" onClick={loadCachedCalculatorData} disabled={status() === 'loading'}>
                            Cached
                        </button>
                        <button class={secondaryButton} type="button" onClick={downloadVaultJson} disabled={!loadedSnapshot()}>
                            Bundle
                        </button>
                        <button
                            class={secondaryButton}
                            type="button"
                            onClick={downloadManifestJson}
                            disabled={loadedManifestDefinitions().length === 0}
                        >
                            Manifest
                        </button>
                        <button class={secondaryButton} type="button" onClick={signOut}>
                            Token
                        </button>
                    </div>
                </div>

                <Show when={loadProgress().active}>
                    <div class={progressWrap}>
                        <div class={progressMeta}>
                            <span>{loadProgress().label}</span>
                            <span>
                                <Show when={loadProgress().total > 0} fallback={`${loadProgress().percent}%`}>
                                    {loadProgress().current} / {loadProgress().total}
                                </Show>
                            </span>
                        </div>
                        <div class={progressTrack}>
                            <div class={progressBar} style={{ width: `${loadProgress().percent}%` }} />
                        </div>
                    </div>
                </Show>
            </section>

            <div class={grid}>
                <section class={panel}>
                    <div class={controlGrid}>
                        <div class={field}>
                            <span class={label}>Character</span>
                            <div class={characterButtonGrid}>
                                <For each={characterButtons()}>
                                    {({ classType, character }) => (
                                        <button
                                            class={characterButton}
                                            type="button"
                                            title={character?.label ?? classType}
                                            aria-label={`Select ${classType}`}
                                            data-selected={character?.characterId === selectedCharacter()?.characterId}
                                            disabled={!character}
                                            style={{ '--class-color': CHARACTER_BUTTON_COLORS[classType] }}
                                            onClick={() => {
                                                if (character) {
                                                    selectCharacter(character.characterId);
                                                }
                                            }}
                                        >
                                            {classType[0]?.toUpperCase()}
                                        </button>
                                    )}
                                </For>
                            </div>
                        </div>

                        <label class={field}>
                            <span class={label}>Exotic</span>
                            <select
                                ref={exoticSelect}
                                class={input}
                                value={selectedExoticItemHash()}
                                onChange={(event) => {
                                    setSelectedExoticItemHash(event.currentTarget.value);
                                    setSolveResult(null);
                                }}
                            >
                                <option value="">No exotic</option>
                                <For each={availableExotics()}>
                                    {(exotic) => (
                                        <option value={String(exotic.itemHash)}>
                                            {exotic.name} ({slotLabels[exotic.slot]}, {exotic.count})
                                        </option>
                                    )}
                                </For>
                            </select>
                        </label>

                        <label class={field}>
                            <span class={label}>Dump Stat</span>
                            <select class={input} value={dumpStat()} onChange={(event) => updateDumpStat(event.currentTarget.value)}>
                                <option value="">No dump stat</option>
                                <For each={ARMOR_STATS}>{(stat) => <option value={stat}>{statLabels[stat]}</option>}</For>
                            </select>
                        </label>
                        <Show when={dumpStat()}>
                            <label class={checkboxField}>
                                <input
                                    type="checkbox"
                                    checked={allowBalancedTuning()}
                                    onChange={(event) => {
                                        setAllowBalancedTuning(event.currentTarget.checked);
                                        setSolveResult(null);
                                    }}
                                />
                                Balanced Tuning
                            </label>
                        </Show>

                        <div class={field}>
                            <span class={label}>Stat Targets</span>
                            <div class={statGrid}>
                                <For each={ARMOR_STATS}>
                                    {(stat) => (
                                        <label class={field}>
                                            <span class={label}>{statLabels[stat]}</span>
                                            <input
                                                class={input}
                                                min="0"
                                                max="200"
                                                type="number"
                                                value={targets()[stat]}
                                                disabled={dumpStat() === stat}
                                                onInput={(event) => updateTarget(stat, event.currentTarget.value)}
                                            />
                                        </label>
                                    )}
                                </For>
                            </div>
                        </div>

                        <div class={field}>
                            <span class={label}>Armor Set Requirements</span>
                            <Show when={selectableSets().length > 0} fallback={<p class={muted}>No 2-piece armor sets available yet.</p>}>
                                <For each={selectableSets()}>
                                    {(set) => (
                                        <label class={field}>
                                            <span class={label}>
                                                {set.name} ({set.count})
                                            </span>
                                            <select
                                                class={input}
                                                value={setSelections()[set.id] ?? '0'}
                                                onChange={(event) => updateSetRequirement(set.id, event.currentTarget.value)}
                                            >
                                                <option value="0">No requirement</option>
                                                <option value="2">Require 2 pieces</option>
                                                <option value="4" disabled={set.count < 4}>
                                                    Require 4 pieces
                                                </option>
                                            </select>
                                        </label>
                                    )}
                                </For>
                            </Show>
                        </div>

                        <button
                            class={button}
                            type="button"
                            onClick={() => solveCurrentBuilds()}
                            disabled={!normalizedProfile() || status() === 'solving'}
                        >
                            Solve Builds
                        </button>
                        <button class={secondaryButton} type="button" onClick={clearSavedCalculatorChoices}>
                            Clear Choices
                        </button>
                    </div>
                </section>

                <section class={panel}>
                    <div class={resultsHeader}>
                        <h2 class={css({ m: 0, fontSize: '20px' })}>Results</h2>
                        <Show when={solveResult()?.ok}>
                            <span class={tinyMuted}>
                                Showing {visibleResultBuilds().length} of {solveResult()?.validBuildCount}
                                <Show when={solveResult()?.resultLimitReached}> ({solveResult()?.returnedBuildCount} retained)</Show>
                            </span>
                        </Show>
                    </div>
                    <Show when={solveResult()} fallback={<p class={muted}>Load profile data, choose constraints, then solve.</p>}>
                        <Show when={!resultFailure()} fallback={<p class={muted}>{resultFailure()}</p>}>
                            <div class={tableWrap}>
                                <table class={table}>
                                    <colgroup>
                                        <col style={{ width: '42px' }} />
                                        <For each={ARMOR_STATS}>{() => <col style={{ width: '52px' }} />}</For>
                                        <col style={{ width: '66px' }} />
                                        <col style={{ width: '260px' }} />
                                    </colgroup>
                                    <thead>
                                        <tr>
                                            <th data-numeric>#</th>
                                            <For each={ARMOR_STATS}>
                                                {(stat) => (
                                                    <th data-numeric title={statLabels[stat]}>
                                                        <button
                                                            class={sortButton}
                                                            type="button"
                                                            aria-label={`Sort by ${statLabels[stat]}`}
                                                            onClick={() => toggleResultSort(stat)}
                                                        >
                                                            {COMPACT_STAT_LABELS[stat]}
                                                            {sortMark(stat)}
                                                        </button>
                                                    </th>
                                                )}
                                            </For>
                                            <th data-numeric>
                                                <button
                                                    class={sortButton}
                                                    type="button"
                                                    aria-label="Sort by total stats"
                                                    onClick={() => toggleResultSort('totalStats')}
                                                >
                                                    Total{sortMark('totalStats')}
                                                </button>
                                            </th>
                                            <th>Bonuses</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <For each={visibleResultBuilds()}>
                                            {(build, index) => (
                                                <>
                                                    <tr
                                                        data-clickable="true"
                                                        data-expanded={expandedBuildKey() === buildExpansionKey(build)}
                                                        tabIndex={0}
                                                        onClick={() => toggleExpandedBuild(build)}
                                                        onKeyDown={(event) => {
                                                            if (event.key === 'Enter' || event.key === ' ') {
                                                                event.preventDefault();
                                                                toggleExpandedBuild(build);
                                                            }
                                                        }}
                                                    >
                                                        <td data-numeric>{index() + 1}</td>
                                                        <For each={ARMOR_STATS}>
                                                            {(stat) => (
                                                                <td data-numeric class={dumpStat() === stat ? tinyMuted : undefined}>
                                                                    {build.stats[stat]}
                                                                </td>
                                                            )}
                                                        </For>
                                                        <td data-numeric>{build.score.totalStats}</td>
                                                        <td data-text-cell>
                                                            <div class={bonusText}>{formatArmorBonusSummary(build)}</div>
                                                        </td>
                                                    </tr>
                                                    <Show when={expandedBuildKey() === buildExpansionKey(build)}>
                                                        <tr>
                                                            <td class={expandCell} colSpan={9}>
                                                                <div class={detailPanel}>
                                                                    <div class={detailGrid} data-tuning={showTuningResults()}>
                                                                        <div class={detailHeader}>Slot</div>
                                                                        <div class={detailHeader}>Armor</div>
                                                                        <div class={detailHeader}>Mod</div>
                                                                        <Show when={showTuningResults()}>
                                                                            <div class={detailHeader}>Tuning</div>
                                                                        </Show>
                                                                        <For each={ARMOR_SLOTS}>
                                                                            {(slot) => (
                                                                                <>
                                                                                    <div class={tinyMuted}>{slotLabels[slot]}</div>
                                                                                    <div
                                                                                        class={truncateText}
                                                                                        title={build.pieces[slot].item.name}
                                                                                    >
                                                                                        {build.pieces[slot].item.name}
                                                                                    </div>
                                                                                    <div
                                                                                        class={truncateText}
                                                                                        title={formatAddonName(build, slot, 'statMod')}
                                                                                    >
                                                                                        {formatAddonName(build, slot, 'statMod')}
                                                                                    </div>
                                                                                    <Show when={showTuningResults()}>
                                                                                        <div
                                                                                            class={truncateText}
                                                                                            title={formatAddonName(build, slot, 'tuning')}
                                                                                        >
                                                                                            {formatAddonName(build, slot, 'tuning')}
                                                                                        </div>
                                                                                    </Show>
                                                                                </>
                                                                            )}
                                                                        </For>
                                                                    </div>
                                                                    <div class={tinyMuted}>
                                                                        Active bonuses: {formatArmorBonusSummary(build)}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    </Show>
                                                </>
                                            )}
                                        </For>
                                    </tbody>
                                </table>
                            </div>
                        </Show>
                    </Show>
                </section>
            </div>
        </main>
    );
}
