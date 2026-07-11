import {
    ARMOR_STATS,
    type ArmorBuild,
    type ArmorBuildSort,
    type ArmorSlot,
    type ArmorStat,
    type ArmorStatTargetCapsInput,
    type SolveArmorInput,
    type SolveArmorResult,
    type StatVector
} from '@armor-calc';
import { createEventListener } from '@solid-primitives/event-listener';
import { debounce } from '@solid-primitives/scheduled';
import type { DestinyInventoryItemDefinition } from 'bungie-api-ts/destiny2';
import { createEffect, createMemo, createSignal, onCleanup, onMount, untrack } from 'solid-js';

import { applyArmorBuild } from '@/features/armor/api/equip-build';
import { absoluteBungieAssetUrl, readBungieUser, readSnapshotMembershipType } from '@/features/armor/api/profile-items';
import { readEquippedSubclassImport } from '@/features/armor/api/subclass-import';
import { type AppTheme, DEFAULT_APP_THEME, sanitizeAppTheme } from '@/features/armor/app-theme';
import { type ArmorCalculatorContextValue, ArmorCalculatorProvider } from '@/features/armor/armor-calculator-context';
import {
    applySetSelectionLimit,
    type CalculatorPreferences,
    clampTarget,
    clearCalculatorPreferences,
    EMPTY_STAT_TARGETS,
    isArmorStat,
    mergeCalculatorPreferencesForStorage,
    readCalculatorPreferences,
    type SetSelectionValue,
    sanitizeArmorSetDisplayMode,
    sanitizeSubclassType,
    sanitizeTargets,
    writeCalculatorPreferences
} from '@/features/armor/calculator-preferences';
import {
    getAvailableExoticOptions,
    getCharacterButtonOptions,
    getResultFailure,
    getSelectableArmorSets,
    getSelectedCharacter,
    getSelectedSetRequirements,
    type ResultSortKey,
    reconcileSelectedExotic,
    reconcileSetSelections,
    sortArmorBuildsForDisplay,
    toggleArmorBuildSort
} from '@/features/armor/calculator-view-model';
import { ArmorAppShell } from '@/features/armor/components/app-shell';
import { AppToolbar, type LoadProgress } from '@/features/armor/components/app-toolbar';
import { CalculatorControls } from '@/features/armor/components/calculator-controls';
import { EquipProgressOverlay, type EquipProgressState } from '@/features/armor/components/equip-progress-overlay';
import { ResultsPanel } from '@/features/armor/components/results-panel';
import { createDebugArmorReport, createDebugExpandedResultReport } from '@/features/armor/debug/armor-debug-report';
import { createBungieManifestResolver } from '@/features/armor/manifest';
import {
    applyEquipProgressUpdate,
    completeEquipProgress,
    createInitialEquipProgress,
    type EquipProgressUpdate,
    finishEquipProgress as finishEquipProgressState,
    markEquipProgressEquippingAll
} from '@/features/armor/model/equip-progress';
import { prepareLoadedCalculatorState } from '@/features/armor/model/loaded-calculator-state';
import { filterFullyMasterworkedProfile } from '@/features/armor/model/profile-filters';
import { setSelectionRecordsEqual } from '@/features/armor/model/set-selections';
import { makeArmorBySlotForClass, normalizeVaultExport } from '@/features/armor/normalize';
import {
    AUTH_LOCK_DISABLED,
    armorSlotCounts,
    canLoadLocalTestData,
    elapsedMs,
    isEditableKeyboardTarget,
    isLocalDevHost,
    logDevTiming
} from '@/features/armor/platform/runtime';
import { type ArmorSetDisplayMode, DEFAULT_RESULT_SORT } from '@/features/armor/result-display';
import { createArmorSolverClient } from '@/features/armor/solver-worker-client';
import {
    formatFragmentBonus,
    fragmentsForSubclass,
    type SubclassType,
    sanitizeFragmentIds,
    sumFragmentBonuses
} from '@/features/armor/subclass-fragments';
import {
    applyVerifiedTargetCap,
    clampTargetsToCaps,
    createPendingTargetCaps,
    MAX_STAT_TARGET_CAPS,
    snapStatTarget,
    targetsAreWithinCaps
} from '@/features/armor/target-cap-state';
import type { LoadedManifestDefinition, NormalizedArmorProfile, VaultExportSnapshot } from '@/features/armor/types';
import { clearCachedVaultSnapshot, downloadJsonFile, exportVaultSnapshot, readCachedVaultSnapshot } from '@/features/bungie/api';
import { getMissingConfigKeys } from '@/features/bungie/config';
import { createAuthorizationUrl, getTokenDebugState, getValidToken, logout } from '@/features/bungie/oauth';

type Status = 'idle' | 'loading' | 'solving' | 'exporting' | 'error' | 'done';

const SOLVER_RESULT_POOL_LIMIT = 5_000;
const VISIBLE_RESULT_LIMIT = 25;
const BALANCED_TUNING_ENABLED = true;
const TEST_DATA_ENDPOINT = '/__rose-test-data__/loaded-benchmark-bundle';

type LoadedBenchmarkBundle = {
    vaultSnapshot?: VaultExportSnapshot;
    normalizedProfile?: NormalizedArmorProfile;
    loadedManifestDefinitions?: LoadedManifestDefinition[];
    manifest?: {
        inventoryItemDefinitions?: Record<string, DestinyInventoryItemDefinition>;
    };
};

export default function Home() {
    let targetCapRequestId = 0;
    let solveRequestId = 0;
    let debugExportChordActive = false;
    let solveInvalidationSuspended = 0;
    const armorSolver = createArmorSolverClient();
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
    const [appTheme, setAppTheme] = createSignal<AppTheme>(DEFAULT_APP_THEME);
    const [selectedCharacterId, setSelectedCharacterId] = createSignal('');
    const [selectedExoticItemHash, setSelectedExoticItemHash] = createSignal('');
    const [armorSetDisplayMode, setArmorSetDisplayMode] = createSignal<ArmorSetDisplayMode>('sets');
    const [selectedSubclass, setSelectedSubclass] = createSignal<SubclassType>('Prismatic');
    const [selectedFragmentIds, setSelectedFragmentIds] = createSignal<string[]>([]);
    const [dumpStat, setDumpStat] = createSignal<ArmorStat | ''>('');
    const [allowBalancedTuning, setAllowBalancedTuning] = createSignal(false);
    const [onlyFullyMasterworkedGear, setOnlyFullyMasterworkedGear] = createSignal(false);
    const [targets, setTargets] = createSignal<StatVector>({ ...EMPTY_STAT_TARGETS });
    const [targetCaps, setTargetCaps] = createSignal<StatVector>({ ...MAX_STAT_TARGET_CAPS });
    const [targetCapsPending, setTargetCapsPending] = createSignal(false);
    const [, setTargetCapCalculationActive] = createSignal(false);
    const [targetCapPriorityStat, setTargetCapPriorityStat] = createSignal<ArmorStat | null>(null);
    const [nextTargetCapRefreshBackground, setNextTargetCapRefreshBackground] = createSignal(false);
    const [importingFragments, setImportingFragments] = createSignal(false);
    const [setSelections, setSetSelections] = createSignal<Record<string, SetSelectionValue>>({});
    const [resultSort, setResultSort] = createSignal<ArmorBuildSort>(DEFAULT_RESULT_SORT);
    const [solveResult, setSolveResult] = createSignal<SolveArmorResult | null>(null);
    const [expandedBuildKey, setExpandedBuildKey] = createSignal<string | null>(null);
    const [equipProgress, setEquipProgress] = createSignal<EquipProgressState | null>(null);
    const [equipOperationActive, setEquipOperationActive] = createSignal(false);
    const [preferencesLoaded, setPreferencesLoaded] = createSignal(false);
    const dismissCompletedEquipProgress = debounce(() => {
        setEquipProgress((current) => (current?.detail === 'Build applied' ? null : current));
    }, 1400);
    const calculatorProfile = createMemo(() => filterFullyMasterworkedProfile(normalizedProfile(), onlyFullyMasterworkedGear()));
    const selectedCharacter = createMemo(() => getSelectedCharacter(calculatorProfile(), selectedCharacterId()));
    const characterButtons = createMemo(() => getCharacterButtonOptions(normalizedProfile()));
    const availableExotics = createMemo(() => getAvailableExoticOptions(calculatorProfile(), selectedCharacter()));
    const selectableSets = createMemo(() => getSelectableArmorSets(calculatorProfile(), selectedCharacter()));
    const selectedExoticBlockedSlots = createMemo(() => {
        const selectedHash = selectedExoticItemHash();
        const selectedExotic = selectedHash ? availableExotics().find((exotic) => String(exotic.itemHash) === selectedHash) : undefined;

        return selectedExotic ? [selectedExotic.slot] : [];
    });
    const resultBuilds = createMemo(() => {
        const result = solveResult();
        if (!result?.ok) {
            return [];
        }

        return sortArmorBuildsForDisplay(result.builds, resultSort());
    });
    const resultFailure = createMemo(() => getResultFailure(solveResult()));
    const showTuningResults = createMemo(() => true);
    const calculatorLocked = createMemo(() => !AUTH_LOCK_DISABLED && !isLocalDevHost() && !authenticated());
    const bungieUser = createMemo(() => readBungieUser(loadedSnapshot()));
    const avatarUrl = createMemo(() => absoluteBungieAssetUrl(bungieUser()?.profilePicturePath));
    const avatarLabel = createMemo(
        () => bungieUser()?.cachedBungieGlobalDisplayName ?? bungieUser()?.uniqueName ?? bungieUser()?.displayName ?? 'Signed in'
    );

    const selectedSetRequirements = createMemo(() =>
        getSelectedSetRequirements(selectableSets(), setSelections(), selectedExoticBlockedSlots())
    );
    const effectiveAllowBalancedTuning = createMemo(() => BALANCED_TUNING_ENABLED && allowBalancedTuning());
    const selectedFragmentBonuses = createMemo(() => sumFragmentBonuses(selectedFragmentIds()));
    const selectedFragmentDetails = createMemo(() => {
        const selectedIds = new Set(selectedFragmentIds());

        return fragmentsForSubclass(selectedSubclass())
            .filter((fragment) => selectedIds.has(fragment.id))
            .map((fragment) => ({
                id: fragment.id,
                name: fragment.name,
                subclass: fragment.subclass,
                hash: fragment.hash,
                bonuses: fragment.bonuses,
                label: formatFragmentBonus(fragment)
            }));
    });
    const targetCapInput = createMemo(() => {
        const profile = calculatorProfile();
        const character = selectedCharacter();

        if (!profile || !character) {
            return null;
        }

        return {
            characterId: character.characterId,
            classType: character.classType,
            selectedExoticItemHash: selectedExoticItemHash() ? Number(selectedExoticItemHash()) : undefined,
            dumpStat: dumpStat() || undefined,
            allowBalancedTuning: effectiveAllowBalancedTuning(),
            statTargets: targets(),
            statBonuses: selectedFragmentBonuses(),
            setRequirements: selectedSetRequirements(),
            armor: makeArmorBySlotForClass(profile.armor, character.classType)
        };
    });

    function toggleResultSort(key: ResultSortKey) {
        setResultSort(toggleArmorBuildSort(resultSort(), key));
    }

    function nextTargetCapRequestId() {
        targetCapRequestId += 1;
        return targetCapRequestId;
    }

    function cancelTargetCapRefresh() {
        targetCapRequestId += 1;
        armorSolver.cancelPending();
        setTargetCapsPending(false);
        setTargetCapCalculationActive(false);
        setTargetCapPriorityStat(null);
        setNextTargetCapRefreshBackground(false);
    }

    async function calculateTargetCapsIncrementally(
        input: ArmorStatTargetCapsInput,
        requestId: number,
        initialCaps: StatVector,
        priorityStat: ArmorStat | null
    ) {
        const nextCaps = { ...initialCaps };
        const startedAt = performance.now();
        logDevTiming('cap batch started', {
            requestId,
            priorityStat,
            targets: input.statTargets,
            initialCaps,
            setRequirements: input.setRequirements.length,
            armorCounts: armorSlotCounts(input)
        });
        try {
            if (priorityStat) {
                const cap = await armorSolver.calculateStatCap(input, priorityStat);
                if (requestId !== targetCapRequestId) {
                    logDevTiming('priority cap ignored after supersede', {
                        requestId,
                        priorityStat,
                        cap,
                        currentRequestId: targetCapRequestId
                    });
                    return;
                }

                const verifiedCaps = applyVerifiedTargetCap(nextCaps, priorityStat, cap, dumpStat());
                nextCaps[priorityStat] = verifiedCaps[priorityStat];
                setTargetCaps(verifiedCaps);
                setTargetCapPriorityStat(null);
                setTargetCapsPending(false);
                setTargetCapCalculationActive(false);

                const requestedTarget = input.statTargets[priorityStat] ?? 0;
                if (requestedTarget > verifiedCaps[priorityStat]) {
                    setNextTargetCapRefreshBackground(true);
                    setTargets((current) => clampTargetsToCaps(current, verifiedCaps, dumpStat(), effectiveAllowBalancedTuning()));
                    invalidateSolve();
                    setTargetCapCalculationActive(false);
                    logDevTiming('priority cap clamped target', {
                        requestId,
                        priorityStat,
                        requested: requestedTarget,
                        cap: verifiedCaps[priorityStat],
                        ms: elapsedMs(startedAt)
                    });
                    return;
                }
            }

            const remainingStats = priorityStat ? ARMOR_STATS.filter((stat) => stat !== priorityStat) : ARMOR_STATS;
            await armorSolver.calculateStatCaps(input, remainingStats, (stat, cap) => {
                if (requestId !== targetCapRequestId) {
                    logDevTiming('cap stat ignored after supersede', {
                        requestId,
                        stat,
                        cap,
                        currentRequestId: targetCapRequestId
                    });
                    return;
                }

                const verifiedCaps = applyVerifiedTargetCap(nextCaps, stat, cap, dumpStat());
                nextCaps[stat] = verifiedCaps[stat];
                setTargetCaps(verifiedCaps);
            });
            if (requestId === targetCapRequestId) {
                setTargetCapsPending(false);
                setTargetCapCalculationActive(false);
                logDevTiming('cap batch completed', {
                    requestId,
                    ms: elapsedMs(startedAt),
                    caps: nextCaps
                });
            } else {
                logDevTiming('cap batch completed stale', {
                    requestId,
                    currentRequestId: targetCapRequestId,
                    ms: elapsedMs(startedAt)
                });
            }
        } catch (error) {
            if (error instanceof Error && error.message === 'Armor solver request superseded.') {
                logDevTiming('cap batch superseded', {
                    requestId,
                    currentRequestId: targetCapRequestId,
                    ms: elapsedMs(startedAt)
                });
                return;
            }

            if (requestId !== targetCapRequestId) {
                logDevTiming('cap batch failed stale', {
                    requestId,
                    currentRequestId: targetCapRequestId,
                    ms: elapsedMs(startedAt)
                });
                return;
            }

            setMessage(error instanceof Error ? error.message : 'Unknown armor stat cap worker failure.');
            setTargetCapsPending(false);
            setTargetCapCalculationActive(false);
            logDevTiming('cap batch failed', {
                requestId,
                ms: elapsedMs(startedAt),
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    function invalidateSolve() {
        if (solveInvalidationSuspended > 0) {
            logDevTiming('solve invalidation suspended', {
                depth: solveInvalidationSuspended
            });
            return;
        }

        solveRequestId += 1;
        setSolveResult(null);
        setExpandedBuildKey(null);
        if (status() === 'solving') {
            setStatus('idle');
        }
        if (status() !== 'loading' && status() !== 'exporting') {
            setLoadProgress({ active: false, label: '', current: 0, total: 0, percent: 0 });
        }
    }

    async function preserveSolveDuring<T>(operation: () => Promise<T>) {
        solveInvalidationSuspended += 1;
        try {
            return await operation();
        } finally {
            solveInvalidationSuspended = Math.max(0, solveInvalidationSuspended - 1);
        }
    }

    function updateEquipProgress(update: EquipProgressUpdate) {
        setEquipProgress((current) => applyEquipProgressUpdate(current, update));
    }

    function finishEquipProgress(detail: string, failedSlot?: ArmorSlot) {
        setEquipProgress((current) => finishEquipProgressState(current, detail, failedSlot));
    }

    function resetBuildChoices() {
        setSelectedExoticItemHash('');
        setArmorSetDisplayMode('sets');
        setSelectedSubclass('Prismatic');
        setSelectedFragmentIds([]);
        setDumpStat('');
        setAllowBalancedTuning(false);
        setOnlyFullyMasterworkedGear(false);
        setTargets({ ...EMPTY_STAT_TARGETS });
        setTargetCaps({ ...MAX_STAT_TARGET_CAPS });
        setTargetCapsPending(false);
        setTargetCapCalculationActive(false);
        setTargetCapPriorityStat(null);
        setNextTargetCapRefreshBackground(false);
        setSetSelections({});
        setResultSort(DEFAULT_RESULT_SORT);
    }

    function selectCharacter(characterId: string) {
        if (characterId === selectedCharacterId()) {
            return;
        }

        setSelectedCharacterId(characterId);
        resetBuildChoices();
        invalidateSolve();
    }

    function refreshAuthState() {
        const debugState = getTokenDebugState();
        setAuthenticated(debugState.authenticated);
        setMessage(
            debugState.authenticated
                ? `Signed in. Access expires at ${debugState.expiresAt}.${
                      debugState.refreshExpiresAt
                          ? ` Refresh expires at ${debugState.refreshExpiresAt}.`
                          : debugState.hasRefreshToken
                            ? ' Refresh token present.'
                            : ' Refresh unavailable for this token.'
                  }`
                : 'Signed out.'
        );
    }

    function downloadDebugVaultExport() {
        downloadJsonFile(
            {
                metadata: {
                    app: 'rose-debug-vault-export',
                    exportVersion: 1,
                    exportedAt: new Date().toISOString(),
                    location: window.location.href
                },
                auth: {
                    authenticated: authenticated()
                },
                calculator: {
                    status: status(),
                    selectedCharacterId: selectedCharacterId(),
                    selectedCharacter: selectedCharacter(),
                    selectedExoticItemHash: selectedExoticItemHash(),
                    armorSetDisplayMode: armorSetDisplayMode(),
                    selectedSubclass: selectedSubclass(),
                    selectedFragmentIds: selectedFragmentIds(),
                    selectedFragments: selectedFragmentDetails(),
                    selectedFragmentBonuses: selectedFragmentBonuses(),
                    dumpStat: dumpStat(),
                    allowBalancedTuning: effectiveAllowBalancedTuning(),
                    onlyFullyMasterworkedGear: onlyFullyMasterworkedGear(),
                    targets: targets(),
                    targetCaps: targetCaps(),
                    targetCapsPending: targetCapsPending(),
                    setSelections: setSelections(),
                    selectedSetRequirements: selectedSetRequirements(),
                    resultSort: resultSort()
                },
                vaultSnapshot: loadedSnapshot(),
                normalizedProfile: normalizedProfile(),
                loadedManifestDefinitions: loadedManifestDefinitions(),
                debug: {
                    fragments: {
                        selectedSubclass: selectedSubclass(),
                        selectedFragmentIds: selectedFragmentIds(),
                        selectedFragments: selectedFragmentDetails(),
                        selectedFragmentBonuses: selectedFragmentBonuses()
                    },
                    maximizedResult: createDebugExpandedResultReport(resultBuilds(), expandedBuildKey()),
                    armor: createDebugArmorReport(loadedSnapshot(), normalizedProfile(), loadedManifestDefinitions())
                },
                solveResult: solveResult()
            },
            'rose-debug-vault-export'
        );
        setMessage('Debug vault export downloaded.');
    }

    onMount(() => {
        refreshAuthState();
        applyCalculatorPreferences(readCalculatorPreferences());
        setPreferencesLoaded(true);
        void loadInitialCalculatorData();

        const pressedKeys = new Set<string>();
        const handleKeyDown = (event: KeyboardEvent) => {
            if (isEditableKeyboardTarget(event.target)) {
                return;
            }

            pressedKeys.add(event.key.toLowerCase());
            const shouldExport = pressedKeys.has('k') && pressedKeys.has('o');
            if (!shouldExport || debugExportChordActive) {
                return;
            }

            debugExportChordActive = true;
            event.preventDefault();
            downloadDebugVaultExport();
        };
        const handleKeyUp = (event: KeyboardEvent) => {
            pressedKeys.delete(event.key.toLowerCase());
            if (!pressedKeys.has('k') || !pressedKeys.has('o')) {
                debugExportChordActive = false;
            }
        };

        createEventListener(window, 'keydown', handleKeyDown);
        createEventListener(window, 'keyup', handleKeyUp);
    });

    onCleanup(() => {
        armorSolver.dispose();
    });

    createEffect(() => {
        if (!preferencesLoaded()) {
            return;
        }

        const currentPreferences = {
            appTheme: appTheme(),
            selectedCharacterId: selectedCharacterId(),
            selectedExoticItemHash: selectedExoticItemHash(),
            armorSetDisplayMode: armorSetDisplayMode(),
            selectedSubclass: selectedSubclass(),
            selectedFragmentIds: selectedFragmentIds(),
            dumpStat: dumpStat(),
            allowBalancedTuning: effectiveAllowBalancedTuning(),
            onlyFullyMasterworkedGear: onlyFullyMasterworkedGear(),
            targets: targets(),
            setSelections: setSelections(),
            resultSort: resultSort()
        };

        writeCalculatorPreferences(
            mergeCalculatorPreferencesForStorage(readCalculatorPreferences(), currentPreferences, Boolean(normalizedProfile()))
        );
    });

    createEffect(() => {
        if (typeof document === 'undefined') {
            return;
        }

        document.documentElement.dataset['theme'] = appTheme();
    });

    createEffect(() => {
        if (equipOperationActive()) {
            return;
        }

        const caps = targetCaps();
        const currentDumpStat = dumpStat();
        let changed = false;

        setTargets((current) => {
            const next = clampTargetsToCaps(current, caps, currentDumpStat, effectiveAllowBalancedTuning());
            changed = next !== current;

            return next;
        });

        if (changed) {
            invalidateSolve();
        }
    });

    createEffect(() => {
        if (equipOperationActive()) {
            return;
        }

        const profile = calculatorProfile();
        const character = selectedCharacter();
        if (!profile || !character) {
            return;
        }

        const nextExotic = reconcileSelectedExotic(profile, character.classType, selectedExoticItemHash());
        if (nextExotic !== selectedExoticItemHash()) {
            setSelectedExoticItemHash(nextExotic);
            invalidateSolve();
        }

        const nextSelections = reconcileSetSelections(profile, character.classType, setSelections(), selectedExoticBlockedSlots());
        if (!setSelectionRecordsEqual(setSelections(), nextSelections)) {
            setSetSelections(nextSelections);
            invalidateSolve();
        }
    });

    createEffect(() => {
        if (equipOperationActive()) {
            return;
        }

        const input = targetCapInput();
        const currentDumpStat = dumpStat();
        const priorityStat = untrack(targetCapPriorityStat);
        const backgroundOnly = untrack(nextTargetCapRefreshBackground);
        setNextTargetCapRefreshBackground(false);
        const requestId = nextTargetCapRequestId();

        armorSolver.cancelPending();

        if (!input) {
            setTargetCaps({ ...MAX_STAT_TARGET_CAPS });
            setTargetCapsPending(false);
            setTargetCapCalculationActive(false);
            return;
        }

        const initialCaps = createPendingTargetCaps(untrack(targets), currentDumpStat);
        setTargetCaps(initialCaps);
        setTargetCapsPending(!backgroundOnly && priorityStat !== null);
        setTargetCapCalculationActive(!backgroundOnly && priorityStat !== null);

        void calculateTargetCapsIncrementally(input, requestId, initialCaps, priorityStat);
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

    async function signOut() {
        armorSolver.cancelPending();
        targetCapRequestId += 1;
        solveRequestId += 1;
        setAuthenticated(false);
        setStatus('idle');
        setNormalizedProfile(null);
        setLoadedSnapshot(null);
        setLoadedManifestDefinitions([]);
        setSolveResult(null);
        setExpandedBuildKey(null);
        setLoadProgress({ active: false, label: '', current: 0, total: 0, percent: 0 });
        setMessage('Signed out.');
        await Promise.all([logout(), clearCachedVaultSnapshot()]);
    }

    async function loadCalculatorData() {
        if (equipOperationActive()) {
            setMessage('Finish applying the current build before refreshing.');
            return;
        }

        if (await loadLocalTestCalculatorData()) {
            return;
        }

        const token = await getValidToken();
        if (!token) {
            setAuthenticated(false);
            setStatus('error');
            setMessage('Missing or expired Bungie sign-in. Sign in again.');
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

    async function loadInitialCalculatorData() {
        if (equipOperationActive()) {
            return;
        }

        if (await loadLocalTestCalculatorData({ silentMissing: true })) {
            return;
        }

        const token = await getValidToken();
        if (!token) {
            await loadCachedCalculatorData({ silentMissing: true });
            return;
        }

        setAuthenticated(true);
        try {
            setStatus('loading');
            setMessage('Refreshing profile from Bungie...');
            setLoadProgress({
                active: true,
                label: 'Refreshing Bungie profile',
                current: 0,
                total: 0,
                percent: 8
            });
            const nextSnapshot = (await exportVaultSnapshot(token)) as VaultExportSnapshot;
            await applyLoadedCalculatorData(nextSnapshot, 'Bungie refresh');
        } catch (error) {
            await loadCachedCalculatorData({ silentMissing: true });
            setMessage(
                error instanceof Error
                    ? `Refresh failed; loaded cache if available. ${error.message}`
                    : 'Refresh failed; loaded cache if available.'
            );
        }
    }

    async function loadLocalTestCalculatorData(options: { silentMissing?: boolean } = {}) {
        if (equipOperationActive()) {
            return false;
        }

        if (!canLoadLocalTestData()) {
            return false;
        }

        try {
            setStatus('loading');
            setMessage('Loading local test armor data...');
            setLoadProgress({
                active: true,
                label: 'Reading local test data',
                current: 0,
                total: 0,
                percent: 12
            });

            const response = await fetch(TEST_DATA_ENDPOINT, { cache: 'no-store' });
            if (response.status === 404) {
                setStatus(options.silentMissing ? 'idle' : 'error');
                setLoadProgress({ active: false, label: '', current: 0, total: 0, percent: 0 });
                setMessage(
                    options.silentMissing
                        ? 'No local test data found. Sign in and refresh once.'
                        : 'No local test data found in data/private.'
                );
                return false;
            }

            if (!response.ok) {
                throw new Error(`Local test data request failed (${response.status})`);
            }

            const bundle = (await response.json()) as LoadedBenchmarkBundle;
            if (!bundle.normalizedProfile) {
                throw new Error('Local test data bundle does not contain a normalized profile.');
            }

            applyLoadedNormalizedCalculatorData(
                bundle.normalizedProfile,
                bundle.vaultSnapshot ?? null,
                bundle.loadedManifestDefinitions ??
                    Object.entries(bundle.manifest?.inventoryItemDefinitions ?? {}).map(([hash, definition]) => ({
                        hash: Number(hash),
                        definition
                    })),
                'local test data'
            );
            return true;
        } catch (error) {
            setStatus('error');
            setLoadProgress({ active: false, label: '', current: 0, total: 0, percent: 0 });
            setMessage(error instanceof Error ? error.message : 'Unknown local test data load failure.');
            return false;
        }
    }

    async function loadCachedCalculatorData(options: { silentMissing?: boolean } = {}) {
        if (equipOperationActive()) {
            return;
        }

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
                setStatus(options.silentMissing ? 'idle' : 'error');
                setLoadProgress({ active: false, label: '', current: 0, total: 0, percent: 0 });
                setMessage(
                    options.silentMissing
                        ? 'No cached profile found. Sign in and refresh once.'
                        : 'No cached profile found yet. Refresh from Bungie once first.'
                );
                return;
            }

            await applyLoadedCalculatorData(cachedSnapshot as VaultExportSnapshot, 'cached profile');
        } catch (error) {
            setStatus('error');
            setLoadProgress({ active: false, label: '', current: 0, total: 0, percent: 0 });
            setMessage(error instanceof Error ? error.message : 'Unknown cached calculator load failure.');
        }
    }

    async function applyLoadedCalculatorData(
        nextSnapshot: VaultExportSnapshot,
        sourceLabel: string,
        options: { preserveSolve?: boolean } = {}
    ) {
        setLoadedSnapshot(null);
        setLoadedManifestDefinitions([]);
        if (!options.preserveSolve) {
            invalidateSolve();
        }

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
        const preparedState = prepareLoadedCalculatorState({
            profile: nextProfile,
            currentCharacterId: selectedCharacterId(),
            currentExoticItemHash: selectedExoticItemHash(),
            currentSetSelections: setSelections(),
            savedPreferences: readCalculatorPreferences()
        });

        setNormalizedProfile(nextProfile);
        setLoadedSnapshot(nextSnapshot);
        setLoadedManifestDefinitions(manifest.getLoadedInventoryItemDefinitions());
        setSelectedCharacterId(preparedState.characterId);
        setSelectedExoticItemHash(preparedState.selectedExoticItemHash);
        setSetSelections(preparedState.setSelections);
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

    function applyLoadedNormalizedCalculatorData(
        nextProfile: NormalizedArmorProfile,
        nextSnapshot: VaultExportSnapshot | null,
        nextManifestDefinitions: LoadedManifestDefinition[],
        sourceLabel: string,
        options: { preserveSolve?: boolean } = {}
    ) {
        setLoadedSnapshot(null);
        setLoadedManifestDefinitions([]);
        if (!options.preserveSolve) {
            invalidateSolve();
        }

        const preparedState = prepareLoadedCalculatorState({
            profile: nextProfile,
            currentCharacterId: selectedCharacterId(),
            currentExoticItemHash: selectedExoticItemHash(),
            currentSetSelections: setSelections(),
            savedPreferences: readCalculatorPreferences()
        });

        setNormalizedProfile(nextProfile);
        setLoadedSnapshot(nextSnapshot);
        setLoadedManifestDefinitions(nextManifestDefinitions);
        setSelectedCharacterId(preparedState.characterId);
        setSelectedExoticItemHash(preparedState.selectedExoticItemHash);
        setSetSelections(preparedState.setSelections);
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
                `Loaded manifest definitions in test bundle: ${nextManifestDefinitions.length}.`,
                `Warnings: ${nextProfile.warnings.length}`
            ].join('\n')
        );
    }

    function createSolveInput(
        profile: NormalizedArmorProfile,
        character: NonNullable<ReturnType<typeof selectedCharacter>>
    ): SolveArmorInput {
        return {
            characterId: character.characterId,
            classType: character.classType,
            selectedExoticItemHash: selectedExoticItemHash() ? Number(selectedExoticItemHash()) : undefined,
            dumpStat: dumpStat() || undefined,
            allowBalancedTuning: effectiveAllowBalancedTuning(),
            statTargets: targets(),
            statBonuses: selectedFragmentBonuses(),
            setRequirements: selectedSetRequirements(),
            armor: makeArmorBySlotForClass(profile.armor, character.classType),
            maxResults: SOLVER_RESULT_POOL_LIMIT,
            stopWhenResultLimitReached: true
        };
    }

    function solveCurrentBuilds() {
        void runSolve();
    }

    async function runSolve() {
        const profile = calculatorProfile();
        const character = selectedCharacter();

        if (!profile || !character) {
            setStatus('error');
            setLoadProgress({ active: false, label: '', current: 0, total: 0, percent: 0 });
            setMessage('Load calculator data before solving.');
            return;
        }

        if (targetCapsPending()) {
            setMessage('Finish checking stat limits before solving.');
            return;
        }

        cancelTargetCapRefresh();

        if (!targetsAreWithinCaps(targets(), targetCaps(), dumpStat(), effectiveAllowBalancedTuning())) {
            setTargets((current) => clampTargetsToCaps(current, targetCaps(), dumpStat(), effectiveAllowBalancedTuning()));
            invalidateSolve();
            return;
        }

        const requestId = solveRequestId + 1;
        solveRequestId = requestId;
        const startedAt = performance.now();
        const solveInput = createSolveInput(profile, character);
        logDevTiming('solve started', {
            requestId,
            targets: targets(),
            caps: targetCaps(),
            setRequirements: selectedSetRequirements().length,
            armorCounts: armorSlotCounts(solveInput)
        });
        setStatus('solving');
        setLoadProgress({
            active: true,
            label: 'Solving builds',
            current: 0,
            total: 0,
            percent: 45
        });
        let result: SolveArmorResult;
        try {
            result = await armorSolver.solve(solveInput);
        } catch (error) {
            if (requestId !== solveRequestId) {
                logDevTiming('solve failed stale', {
                    requestId,
                    currentRequestId: solveRequestId,
                    ms: elapsedMs(startedAt)
                });
                return;
            }

            setStatus('error');
            setLoadProgress({ active: false, label: '', current: 0, total: 0, percent: 0 });
            setMessage(error instanceof Error ? error.message : 'Unknown armor solver worker failure.');
            logDevTiming('solve failed', {
                requestId,
                ms: elapsedMs(startedAt),
                error: error instanceof Error ? error.message : String(error)
            });
            return;
        }

        if (requestId !== solveRequestId) {
            logDevTiming('solve completed stale', {
                requestId,
                currentRequestId: solveRequestId,
                ms: elapsedMs(startedAt)
            });
            return;
        }

        setSolveResult(result);
        setStatus(result.ok ? 'done' : 'error');
        setLoadProgress({ active: false, label: '', current: 0, total: 0, percent: 0 });
        setMessage(
            result.ok
                ? `Found ${result.validBuildCount} builds. Showing ${Math.min(VISIBLE_RESULT_LIMIT, result.returnedBuildCount)}. Searched ${result.searchedCombinations} armor combinations.`
                : `${result.reason}\nSearched ${result.searchedCombinations} armor combinations.`
        );
        logDevTiming('solve completed', {
            requestId,
            ms: elapsedMs(startedAt),
            ok: result.ok,
            validBuildCount: result.ok ? result.validBuildCount : 0,
            returnedBuildCount: result.ok ? result.returnedBuildCount : 0,
            searchedCombinations: result.searchedCombinations
        });
    }

    async function importFragmentsFromGame() {
        if (equipOperationActive()) {
            setMessage('Finish applying the current build before importing fragments.');
            return;
        }

        if (importingFragments()) {
            return;
        }

        setImportingFragments(true);

        try {
            setMessage('Importing equipped subclass fragments from Bungie...');

            const token = await getValidToken();
            const freshSnapshot = token ? ((await exportVaultSnapshot(token)) as VaultExportSnapshot) : loadedSnapshot();
            if (token) {
                setAuthenticated(true);
            }

            if (!freshSnapshot) {
                setMessage('No loaded profile is available to import fragments from.');
                return;
            }

            const manifest = await createBungieManifestResolver();
            const imported = await readEquippedSubclassImport(freshSnapshot, selectedCharacterId(), loadedManifestDefinitions(), (hash) =>
                manifest.getInventoryItem(hash)
            );

            if (!imported) {
                setMessage('Could not read an equipped subclass for the selected character.');
                return;
            }

            setLoadedSnapshot(freshSnapshot);
            setNextTargetCapRefreshBackground(true);
            setSelectedSubclass(imported.subclass);
            setSelectedFragmentIds(sanitizeFragmentIds(imported.fragmentIds, imported.subclass));
            setTargetCapPriorityStat(null);
            invalidateSolve();
            setMessage(
                [
                    `Imported ${imported.subclassItemName}: ${imported.fragmentIds.length} known fragments selected.`,
                    imported.missingFragmentPlugHashes.length > 0
                        ? `Ignored ${imported.missingFragmentPlugHashes.length} fragment plug(s) that are not in rose yet.`
                        : null
                ]
                    .filter(Boolean)
                    .join(' ')
            );
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Unknown equipped subclass import failure.');
        } finally {
            setImportingFragments(false);
        }
    }

    async function equipBuildItems(build: ArmorBuild) {
        if (equipOperationActive()) {
            throw new Error('A build is already being applied.');
        }

        const token = await getValidToken();
        const snapshot = loadedSnapshot();
        const character = selectedCharacter();
        const membershipType = readSnapshotMembershipType(snapshot);

        if (!token) {
            throw new Error('Sign in again before equipping items.');
        }

        if (!snapshot || !character || membershipType === null) {
            throw new Error('Load a Bungie profile before equipping items.');
        }

        setEquipProgress(createInitialEquipProgress(build));
        setEquipOperationActive(true);

        let itemIds: string[] = [];
        let currentEquipSlot: ArmorSlot | undefined;

        try {
            await preserveSolveDuring(async () => {
                const result = await applyArmorBuild({
                    token,
                    snapshot,
                    membershipType,
                    characterId: character.characterId,
                    build,
                    loadedManifestDefinitions: loadedManifestDefinitions(),
                    onProgress: (update) => {
                        currentEquipSlot = update.slot;
                        updateEquipProgress(update);
                    },
                    onEquippingAll: () => {
                        currentEquipSlot = undefined;
                        setEquipProgress((current) => markEquipProgressEquippingAll(current));
                    }
                });
                itemIds = result.itemIds;

                setEquipProgress((current) => completeEquipProgress(current));
                dismissCompletedEquipProgress();
                setMessage('Equipped build. Refreshing profile...');
                const nextSnapshot = (await exportVaultSnapshot(token)) as VaultExportSnapshot;
                await applyLoadedCalculatorData(nextSnapshot, 'Bungie refresh', { preserveSolve: true });
            });
        } catch (error) {
            finishEquipProgress(error instanceof Error ? error.message : 'Unknown equip failure.', currentEquipSlot);
            console.error('[rose bungie api] Equip build failed', {
                characterId: character.characterId,
                membershipType,
                itemIds,
                error
            });
            setMessage(error instanceof Error ? error.message : 'Unknown equip failure.');
            throw error;
        } finally {
            setEquipOperationActive(false);
        }
    }

    function updateTarget(stat: ArmorStat, value: string) {
        const cap = dumpStat() === stat ? 0 : clampTarget(targetCaps()[stat]);
        const numericValue = snapStatTarget(Number(value) || 0, cap, effectiveAllowBalancedTuning());

        setTargetCapPriorityStat(stat);
        setTargets((current) => ({
            ...current,
            [stat]: numericValue
        }));
        invalidateSolve();
    }

    function updateSubclass(value: SubclassType) {
        const nextSubclass = sanitizeSubclassType(value);
        setNextTargetCapRefreshBackground(true);
        setSelectedSubclass(nextSubclass);
        setSelectedFragmentIds((current) => sanitizeFragmentIds(current, nextSubclass));
        setTargetCapPriorityStat(null);
        invalidateSolve();
    }

    function toggleFragment(fragmentId: string) {
        setNextTargetCapRefreshBackground(true);
        setSelectedFragmentIds((current) => {
            const selected = new Set(current);
            if (selected.has(fragmentId)) {
                selected.delete(fragmentId);
            } else {
                selected.add(fragmentId);
            }

            return sanitizeFragmentIds([...selected], selectedSubclass());
        });
        setTargetCapPriorityStat(null);
        invalidateSolve();
    }

    function updateDumpStat(value: string) {
        const nextDumpStat = isArmorStat(value) ? value : '';
        setDumpStat(nextDumpStat);
        invalidateSolve();

        if (!nextDumpStat) {
            setAllowBalancedTuning(false);
        }

        if (nextDumpStat) {
            setTargets((current) =>
                clampTargetsToCaps({ ...current, [nextDumpStat]: 0 }, targetCaps(), nextDumpStat, effectiveAllowBalancedTuning())
            );
        }
    }

    function updateSetRequirement(setId: string, value: string) {
        setSetSelections((current) => applySetSelectionLimit(current, setId, value === '2' || value === '4' ? value : '0'));
        invalidateSolve();
    }

    function applyCalculatorPreferences(preferences: CalculatorPreferences | null) {
        if (!preferences) {
            return;
        }

        const nextDumpStat = preferences.dumpStat && isArmorStat(preferences.dumpStat) ? preferences.dumpStat : '';
        const nextSubclass = sanitizeSubclassType(preferences.selectedSubclass);
        const nextAllowBalancedTuning = BALANCED_TUNING_ENABLED && preferences.allowBalancedTuning === true;
        const nextTargets = { ...EMPTY_STAT_TARGETS, ...sanitizeTargets(preferences.targets) };
        for (const stat of ARMOR_STATS) {
            nextTargets[stat] = snapStatTarget(nextTargets[stat], MAX_STAT_TARGET_CAPS[stat], nextAllowBalancedTuning);
        }
        if (nextDumpStat) {
            nextTargets[nextDumpStat] = 0;
        }

        setAppTheme(sanitizeAppTheme(preferences.appTheme));
        setSelectedCharacterId(preferences.selectedCharacterId ?? '');
        setSelectedExoticItemHash(preferences.selectedExoticItemHash ?? '');
        setArmorSetDisplayMode(sanitizeArmorSetDisplayMode(preferences.armorSetDisplayMode));
        setSelectedSubclass(nextSubclass);
        setSelectedFragmentIds(sanitizeFragmentIds(preferences.selectedFragmentIds, nextSubclass));
        setDumpStat(nextDumpStat);
        setAllowBalancedTuning(nextAllowBalancedTuning);
        setOnlyFullyMasterworkedGear(preferences.onlyFullyMasterworkedGear === true);
        setTargets(nextTargets);
        setSetSelections(preferences.setSelections ?? {});
        setResultSort(preferences.resultSort ?? DEFAULT_RESULT_SORT);
    }

    function clearSavedCalculatorChoices() {
        clearCalculatorPreferences();
        resetBuildChoices();
        invalidateSolve();
        setStatus('idle');
        setMessage('Calculator choices cleared.');
    }

    const calculatorContext = {
        controls: {
            characterOptions: characterButtons,
            selectedCharacterId: () => selectedCharacter()?.characterId ?? '',
            selectedExoticItemHash,
            armorSetDisplayMode,
            selectedSubclass,
            selectedFragmentIds,
            importingFragments,
            dumpStat,
            allowBalancedTuning: effectiveAllowBalancedTuning,
            onlyFullyMasterworkedGear,
            targets,
            targetCaps,
            targetCapsPending,
            setSelections,
            availableExotics,
            selectableSets,
            canSolve: () =>
                !calculatorLocked() &&
                Boolean(normalizedProfile()) &&
                status() !== 'loading' &&
                status() !== 'solving' &&
                !targetCapsPending(),
            solving: () => status() === 'loading' || status() === 'solving'
        },
        results: {
            result: solveResult,
            builds: resultBuilds,
            armorSets: selectableSets,
            armorSetDisplayMode,
            resultFailure,
            sort: resultSort,
            dumpStat,
            loading: () => status() === 'loading' || status() === 'solving',
            progress: loadProgress,
            showTuningResults,
            visibleLimit: () => VISIBLE_RESULT_LIMIT,
            expandedBuildKey
        },
        actions: {
            selectCharacter,
            selectExotic: (itemHash) => {
                setSelectedExoticItemHash(itemHash);
                invalidateSolve();
            },
            setArmorSetDisplayMode,
            setSubclass: updateSubclass,
            toggleFragment,
            importFragmentsFromGame,
            setDumpStat: updateDumpStat,
            setAllowBalancedTuning: (enabled) => {
                setAllowBalancedTuning(BALANCED_TUNING_ENABLED && enabled);
                invalidateSolve();
            },
            setOnlyFullyMasterworkedGear: (enabled) => {
                setOnlyFullyMasterworkedGear(enabled);
                invalidateSolve();
            },
            setTarget: updateTarget,
            setRequirement: updateSetRequirement,
            solve: solveCurrentBuilds,
            clearChoices: clearSavedCalculatorChoices,
            setExpandedBuildKey,
            equipBuild: equipBuildItems,
            sortResults: toggleResultSort
        }
    } satisfies ArmorCalculatorContextValue;

    return (
        <ArmorCalculatorProvider value={calculatorContext}>
            <ArmorAppShell
                locked={calculatorLocked()}
                toolbar={
                    <AppToolbar
                        authenticated={authenticated()}
                        avatarLabel={avatarLabel()}
                        avatarUrl={avatarUrl()}
                        loading={status() === 'loading'}
                        theme={appTheme()}
                        onSignIn={signIn}
                        onRefresh={loadCalculatorData}
                        onLogout={() => void signOut()}
                        onThemeChange={setAppTheme}
                    />
                }
                controls={<CalculatorControls />}
                results={<ResultsPanel />}
            />
            <EquipProgressOverlay progress={equipProgress()} onDismiss={() => setEquipProgress(null)} />
        </ArmorCalculatorProvider>
    );
}
