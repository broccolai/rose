import {
    ARMOR_STATS,
    type ArmorBuildSort,
    type ArmorStat,
    type ArmorStatTargetCapsInput,
    type SolveArmorInput,
    type SolveArmorResult,
    type StatVector
} from '@armor-calc';
import { createEffect, createMemo, createSignal, onCleanup, onMount, untrack } from 'solid-js';

import {
    type CalculatorPreferences,
    clampTarget,
    clearCalculatorPreferences,
    EMPTY_STAT_TARGETS,
    isArmorStat,
    mergeCalculatorPreferencesForStorage,
    readCalculatorPreferences,
    type SetSelectionValue,
    sanitizeArmorSetDisplayMode,
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
import { ResultsPanel } from '@/features/armor/components/results-panel';
import { createBungieManifestResolver } from '@/features/armor/manifest';
import { makeArmorBySlotForClass, normalizeVaultExport } from '@/features/armor/normalize';
import { type ArmorSetDisplayMode, DEFAULT_RESULT_SORT } from '@/features/armor/result-display';
import { createArmorSolverClient } from '@/features/armor/solver-worker-client';
import {
    applyVerifiedTargetCap,
    clampTargetsToCaps,
    createPendingTargetCaps,
    MAX_STAT_TARGET_CAPS,
    snapStatTarget,
    targetsAreWithinCaps
} from '@/features/armor/target-cap-state';
import type {
    LoadedManifestDefinition,
    ManifestInventoryItemDefinition,
    NormalizedArmorProfile,
    VaultExportSnapshot
} from '@/features/armor/types';
import { downloadJsonFile, exportVaultSnapshot, readCachedVaultSnapshot } from '@/features/bungie/api';
import { getMissingConfigKeys } from '@/features/bungie/config';
import { createAuthorizationUrl, getTokenDebugState, getValidToken } from '@/features/bungie/oauth';

type Status = 'idle' | 'loading' | 'solving' | 'exporting' | 'error' | 'done';

const SOLVER_RESULT_POOL_LIMIT = 30_000;
const VISIBLE_RESULT_LIMIT = 25;
const BALANCED_TUNING_ENABLED = true;
const AUTH_LOCK_DISABLED = import.meta.env.DEV || import.meta.env.MODE === 'test';
const DEV_TIMING = import.meta.env.DEV;
const BUNGIE_ORIGIN = 'https://www.bungie.net';
const TEST_DATA_ENDPOINT = '/__rose-test-data__/loaded-benchmark-bundle';

type CachedBungieUser = {
    cachedBungieGlobalDisplayName?: string;
    displayName?: string;
    profilePicturePath?: string;
    uniqueName?: string;
};

type CachedMembershipsResponse = {
    Response?: {
        bungieNetUser?: CachedBungieUser;
    };
};

type LoadedBenchmarkBundle = {
    vaultSnapshot?: VaultExportSnapshot;
    normalizedProfile?: NormalizedArmorProfile;
    loadedManifestDefinitions?: LoadedManifestDefinition[];
    manifest?: {
        inventoryItemDefinitions?: Record<string, ManifestInventoryItemDefinition>;
    };
};

function readBungieUser(snapshot: VaultExportSnapshot | null): CachedBungieUser | undefined {
    return (snapshot?.membershipsResponse as CachedMembershipsResponse | undefined)?.Response?.bungieNetUser;
}

function absoluteBungieAssetUrl(path?: string) {
    if (!path) {
        return undefined;
    }

    if (path.startsWith('http://') || path.startsWith('https://')) {
        return path;
    }

    return `${BUNGIE_ORIGIN}${path}`;
}

function isEditableKeyboardTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) {
        return false;
    }

    return (
        target.isContentEditable ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLTextAreaElement
    );
}

function isLocalDevHost() {
    if (typeof window === 'undefined') {
        return false;
    }

    return ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
}

function canLoadLocalTestData() {
    return AUTH_LOCK_DISABLED || isLocalDevHost();
}

function elapsedMs(startedAt: number) {
    return Math.round((performance.now() - startedAt) * 10) / 10;
}

function logDevTiming(label: string, details: Record<string, unknown>) {
    if (!DEV_TIMING) {
        return;
    }

    console.debug(`[rose timing] ${label}`, details);
}

function armorSlotCounts(input: ArmorStatTargetCapsInput | SolveArmorInput) {
    return Object.fromEntries(Object.entries(input.armor).map(([slot, armor]) => [slot, armor.length]));
}

export default function Home() {
    let targetCapRequestId = 0;
    let solveRequestId = 0;
    let debugExportChordActive = false;
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
    const [selectedCharacterId, setSelectedCharacterId] = createSignal('');
    const [selectedExoticItemHash, setSelectedExoticItemHash] = createSignal('');
    const [armorSetDisplayMode, setArmorSetDisplayMode] = createSignal<ArmorSetDisplayMode>('sets');
    const [dumpStat, setDumpStat] = createSignal<ArmorStat | ''>('');
    const [allowBalancedTuning, setAllowBalancedTuning] = createSignal(false);
    const [targets, setTargets] = createSignal<StatVector>({ ...EMPTY_STAT_TARGETS });
    const [targetCaps, setTargetCaps] = createSignal<StatVector>({ ...MAX_STAT_TARGET_CAPS });
    const [targetCapsPending, setTargetCapsPending] = createSignal(false);
    const [targetCapPriorityStat, setTargetCapPriorityStat] = createSignal<ArmorStat | null>(null);
    const [nextTargetCapRefreshBackground, setNextTargetCapRefreshBackground] = createSignal(false);
    const [setSelections, setSetSelections] = createSignal<Record<string, SetSelectionValue>>({});
    const [resultSort, setResultSort] = createSignal<ArmorBuildSort>(DEFAULT_RESULT_SORT);
    const [solveResult, setSolveResult] = createSignal<SolveArmorResult | null>(null);
    const [preferencesLoaded, setPreferencesLoaded] = createSignal(false);
    const selectedCharacter = createMemo(() => getSelectedCharacter(normalizedProfile(), selectedCharacterId()));
    const characterButtons = createMemo(() => getCharacterButtonOptions(normalizedProfile()));
    const availableExotics = createMemo(() => getAvailableExoticOptions(normalizedProfile(), selectedCharacter()));
    const selectableSets = createMemo(() => getSelectableArmorSets(normalizedProfile(), selectedCharacter()));
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

    const selectedSetRequirements = createMemo(() => getSelectedSetRequirements(selectableSets(), setSelections()));
    const effectiveAllowBalancedTuning = createMemo(() => BALANCED_TUNING_ENABLED && allowBalancedTuning());
    const targetCapInput = createMemo(() => {
        const profile = normalizedProfile();
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

                const requestedTarget = input.statTargets[priorityStat] ?? 0;
                if (requestedTarget > verifiedCaps[priorityStat]) {
                    setNextTargetCapRefreshBackground(true);
                    setTargets((current) => clampTargetsToCaps(current, verifiedCaps, dumpStat(), effectiveAllowBalancedTuning()));
                    invalidateSolve();
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
            logDevTiming('cap batch failed', {
                requestId,
                ms: elapsedMs(startedAt),
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    function invalidateSolve() {
        solveRequestId += 1;
        setSolveResult(null);
    }

    function resetBuildChoices() {
        setSelectedExoticItemHash('');
        setArmorSetDisplayMode('sets');
        setDumpStat('');
        setAllowBalancedTuning(false);
        setTargets({ ...EMPTY_STAT_TARGETS });
        setTargetCaps({ ...MAX_STAT_TARGET_CAPS });
        setTargetCapsPending(false);
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
                ? `Signed in. Access expires at ${debugState.expiresAt}.${debugState.refreshExpiresAt ? ` Refresh expires at ${debugState.refreshExpiresAt}.` : ''}`
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
                    dumpStat: dumpStat(),
                    allowBalancedTuning: effectiveAllowBalancedTuning(),
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

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        onCleanup(() => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        });
    });

    onCleanup(() => {
        armorSolver.dispose();
    });

    createEffect(() => {
        if (!preferencesLoaded()) {
            return;
        }

        const currentPreferences = {
            selectedCharacterId: selectedCharacterId(),
            selectedExoticItemHash: selectedExoticItemHash(),
            armorSetDisplayMode: armorSetDisplayMode(),
            dumpStat: dumpStat(),
            allowBalancedTuning: effectiveAllowBalancedTuning(),
            targets: targets(),
            setSelections: setSelections(),
            resultSort: resultSort()
        };

        writeCalculatorPreferences(
            mergeCalculatorPreferencesForStorage(readCalculatorPreferences(), currentPreferences, Boolean(normalizedProfile()))
        );
    });

    createEffect(() => {
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
            return;
        }

        const initialCaps = createPendingTargetCaps(untrack(targets), currentDumpStat);
        setTargetCaps(initialCaps);
        setTargetCapsPending(!backgroundOnly);

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

    async function loadCalculatorData() {
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
        if (await loadLocalTestCalculatorData({ silentMissing: true })) {
            return;
        }

        await loadCachedCalculatorData({ silentMissing: true });
    }

    async function loadLocalTestCalculatorData(options: { silentMissing?: boolean } = {}) {
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

    async function applyLoadedCalculatorData(nextSnapshot: VaultExportSnapshot, sourceLabel: string) {
        setLoadedSnapshot(null);
        setLoadedManifestDefinitions([]);
        invalidateSolve();

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

    function applyLoadedNormalizedCalculatorData(
        nextProfile: NormalizedArmorProfile,
        nextSnapshot: VaultExportSnapshot | null,
        nextManifestDefinitions: LoadedManifestDefinition[],
        sourceLabel: string
    ) {
        setLoadedSnapshot(null);
        setLoadedManifestDefinitions([]);
        invalidateSolve();

        const savedPreferences = readCalculatorPreferences();
        const desiredCharacterId = selectedCharacterId() || savedPreferences?.selectedCharacterId || '';
        const desiredExoticItemHash = selectedExoticItemHash() || savedPreferences?.selectedExoticItemHash || '';
        const selectedCharacter =
            nextProfile.characters.find((character) => character.characterId === desiredCharacterId) ?? nextProfile.characters[0];
        const nextCharacterId = selectedCharacter?.characterId ?? '';
        const nextCharacterClass = selectedCharacter?.classType ?? 'any';

        setNormalizedProfile(nextProfile);
        setLoadedSnapshot(nextSnapshot);
        setLoadedManifestDefinitions(nextManifestDefinitions);
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
            setRequirements: selectedSetRequirements(),
            armor: makeArmorBySlotForClass(profile.armor, character.classType),
            maxResults: SOLVER_RESULT_POOL_LIMIT,
            stopWhenResultLimitReached: true
        };
    }

    async function solveCurrentBuilds() {
        const profile = normalizedProfile();
        const character = selectedCharacter();

        if (!profile || !character) {
            setStatus('error');
            setMessage('Load calculator data before solving.');
            return;
        }

        if (targetCapsPending()) {
            setMessage('Waiting for stat caps to finish updating.');
            return;
        }

        if (!targetsAreWithinCaps(targets(), targetCaps(), dumpStat(), effectiveAllowBalancedTuning())) {
            setTargets((current) => clampTargetsToCaps(current, targetCaps(), dumpStat(), effectiveAllowBalancedTuning()));
            invalidateSolve();
            setMessage('Stat targets were adjusted to verified caps. Solve again.');
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
            percent: 35
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
                ? [
                      `Found ${result.validBuildCount} builds. Retained ${result.returnedBuildCount}. Showing ${Math.min(VISIBLE_RESULT_LIMIT, result.returnedBuildCount)}.`,
                      result.resultLimitReached ? 'Result pool hit the 30k cap; table sorting applies to retained builds.' : null,
                      `Searched ${result.searchedCombinations} armor combinations.`
                  ]
                      .filter(Boolean)
                      .join(' ')
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
        setSetSelections((current) => ({
            ...current,
            [setId]: value === '2' || value === '4' ? value : '0'
        }));
        invalidateSolve();
    }

    function applyCalculatorPreferences(preferences: CalculatorPreferences | null) {
        if (!preferences) {
            return;
        }

        const nextDumpStat = preferences.dumpStat && isArmorStat(preferences.dumpStat) ? preferences.dumpStat : '';
        const nextAllowBalancedTuning = BALANCED_TUNING_ENABLED && preferences.allowBalancedTuning === true;
        const nextTargets = { ...EMPTY_STAT_TARGETS, ...sanitizeTargets(preferences.targets) };
        for (const stat of ARMOR_STATS) {
            nextTargets[stat] = snapStatTarget(nextTargets[stat], MAX_STAT_TARGET_CAPS[stat], nextAllowBalancedTuning);
        }
        if (nextDumpStat) {
            nextTargets[nextDumpStat] = 0;
        }

        setSelectedCharacterId(preferences.selectedCharacterId ?? '');
        setSelectedExoticItemHash(preferences.selectedExoticItemHash ?? '');
        setArmorSetDisplayMode(sanitizeArmorSetDisplayMode(preferences.armorSetDisplayMode));
        setDumpStat(nextDumpStat);
        setAllowBalancedTuning(nextAllowBalancedTuning);
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

    return (
        <ArmorAppShell
            locked={calculatorLocked()}
            toolbar={
                <AppToolbar
                    authenticated={authenticated()}
                    avatarLabel={avatarLabel()}
                    avatarUrl={avatarUrl()}
                    loading={status() === 'loading'}
                    onSignIn={signIn}
                    onRefresh={loadCalculatorData}
                />
            }
            controls={
                <CalculatorControls
                    characterOptions={characterButtons()}
                    selectedCharacterId={selectedCharacter()?.characterId ?? ''}
                    selectedExoticItemHash={selectedExoticItemHash()}
                    armorSetDisplayMode={armorSetDisplayMode()}
                    dumpStat={dumpStat()}
                    allowBalancedTuning={effectiveAllowBalancedTuning()}
                    targets={targets()}
                    targetCaps={targetCaps()}
                    targetCapsPending={targetCapsPending()}
                    setSelections={setSelections()}
                    availableExotics={availableExotics()}
                    selectableSets={selectableSets()}
                    canSolve={!calculatorLocked() && Boolean(normalizedProfile()) && status() !== 'loading' && !targetCapsPending()}
                    solving={status() === 'loading' || status() === 'solving'}
                    onCharacterSelect={selectCharacter}
                    onArmorSetDisplayModeChange={setArmorSetDisplayMode}
                    onExoticChange={(itemHash) => {
                        setSelectedExoticItemHash(itemHash);
                        invalidateSolve();
                    }}
                    onDumpStatChange={updateDumpStat}
                    onBalancedTuningChange={(enabled) => {
                        setAllowBalancedTuning(BALANCED_TUNING_ENABLED && enabled);
                        invalidateSolve();
                    }}
                    onTargetChange={updateTarget}
                    onSetRequirementChange={updateSetRequirement}
                    onSolve={solveCurrentBuilds}
                    onClearChoices={clearSavedCalculatorChoices}
                />
            }
            results={
                <ResultsPanel
                    result={solveResult()}
                    builds={resultBuilds()}
                    armorSets={selectableSets()}
                    armorSetDisplayMode={armorSetDisplayMode()}
                    resultFailure={resultFailure()}
                    sort={resultSort()}
                    dumpStat={dumpStat()}
                    loading={status() === 'loading' || status() === 'solving'}
                    progress={loadProgress()}
                    showTuningResults={showTuningResults()}
                    visibleLimit={VISIBLE_RESULT_LIMIT}
                    onSort={toggleResultSort}
                />
            }
        />
    );
}
