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
import { DEFAULT_RESULT_SORT } from '@/features/armor/result-display';
import { createArmorSolverClient } from '@/features/armor/solver-worker-client';
import type { LoadedManifestDefinition, NormalizedArmorProfile, VaultExportSnapshot } from '@/features/armor/types';
import { downloadJsonFile, exportVaultSnapshot, readCachedVaultSnapshot } from '@/features/bungie/api';
import { getMissingConfigKeys } from '@/features/bungie/config';
import { createAuthorizationUrl, getTokenDebugState, readToken } from '@/features/bungie/oauth';

type Status = 'idle' | 'loading' | 'solving' | 'exporting' | 'error' | 'done';

const SOLVER_RESULT_POOL_LIMIT = 30_000;
const VISIBLE_RESULT_LIMIT = 25;
const BALANCED_TUNING_ENABLED = false;
const MAX_STAT_TARGET_CAPS: StatVector = {
    health: 200,
    melee: 200,
    grenade: 200,
    super: 200,
    class: 200,
    weapons: 200
};
const BUNGIE_ORIGIN = 'https://www.bungie.net';

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
    const [dumpStat, setDumpStat] = createSignal<ArmorStat | ''>('');
    const [allowBalancedTuning, setAllowBalancedTuning] = createSignal(false);
    const [targets, setTargets] = createSignal<StatVector>({ ...EMPTY_STAT_TARGETS });
    const [targetCaps, setTargetCaps] = createSignal<StatVector>({ ...MAX_STAT_TARGET_CAPS });
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
    const showTuningResults = createMemo(() => Boolean(dumpStat()));
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

    async function calculateTargetCapsIncrementally(input: ArmorStatTargetCapsInput, requestId: number, initialCaps: StatVector) {
        const nextCaps = { ...initialCaps };
        try {
            await armorSolver.calculateStatCaps(input, ARMOR_STATS, (stat, cap) => {
                if (requestId !== targetCapRequestId) {
                    return;
                }

                nextCaps[stat] = cap;
                setTargetCaps({ ...nextCaps });
            });
        } catch (error) {
            if (requestId !== targetCapRequestId) {
                return;
            }

            setMessage(error instanceof Error ? error.message : 'Unknown armor stat cap worker failure.');
        }
    }

    function invalidateSolve() {
        solveRequestId += 1;
        setSolveResult(null);
    }

    function selectCharacter(characterId: string) {
        setSelectedCharacterId(characterId);
        setSelectedExoticItemHash('');
        setSetSelections({});
        invalidateSolve();
    }

    function refreshAuthState() {
        const debugState = getTokenDebugState();
        setAuthenticated(debugState.authenticated);
        setMessage(debugState.authenticated ? `Signed in. Token expires at ${debugState.expiresAt}.` : 'Signed out.');
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
                    dumpStat: dumpStat(),
                    allowBalancedTuning: effectiveAllowBalancedTuning(),
                    targets: targets(),
                    targetCaps: targetCaps(),
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
        void loadCachedCalculatorData({ silentMissing: true });

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
            const next = { ...current };

            for (const stat of ARMOR_STATS) {
                const cappedValue = stat === currentDumpStat ? 0 : Math.min(current[stat], caps[stat]);
                if (cappedValue !== current[stat]) {
                    next[stat] = cappedValue;
                    changed = true;
                }
            }

            return changed ? next : current;
        });

        if (changed) {
            invalidateSolve();
        }
    });

    createEffect(() => {
        const input = targetCapInput();
        const currentDumpStat = dumpStat();
        const requestId = nextTargetCapRequestId();

        if (!input) {
            setTargetCaps({ ...MAX_STAT_TARGET_CAPS });
            return;
        }

        const initialCaps = { ...untrack(targetCaps) };
        if (currentDumpStat) {
            initialCaps[currentDumpStat] = 0;
        }
        setTargetCaps(initialCaps);

        void calculateTargetCapsIncrementally(input, requestId, initialCaps);
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
            maxResults: SOLVER_RESULT_POOL_LIMIT
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

        const requestId = solveRequestId + 1;
        solveRequestId = requestId;
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
            result = await armorSolver.solve(createSolveInput(profile, character));
        } catch (error) {
            if (requestId !== solveRequestId) {
                return;
            }

            setStatus('error');
            setLoadProgress({ active: false, label: '', current: 0, total: 0, percent: 0 });
            setMessage(error instanceof Error ? error.message : 'Unknown armor solver worker failure.');
            return;
        }

        if (requestId !== solveRequestId) {
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
    }

    function updateTarget(stat: ArmorStat, value: string) {
        const cap = targetCaps()[stat];
        const numericValue = Math.min(clampTarget(Number(value) || 0), cap);

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
        invalidateSolve();
    }

    function applyCalculatorPreferences(preferences: CalculatorPreferences | null) {
        if (!preferences) {
            return;
        }

        const nextDumpStat = preferences.dumpStat && isArmorStat(preferences.dumpStat) ? preferences.dumpStat : '';
        const nextTargets = { ...EMPTY_STAT_TARGETS, ...sanitizeTargets(preferences.targets) };
        if (nextDumpStat) {
            nextTargets[nextDumpStat] = 0;
        }

        setSelectedCharacterId(preferences.selectedCharacterId ?? '');
        setSelectedExoticItemHash(preferences.selectedExoticItemHash ?? '');
        setDumpStat(nextDumpStat);
        setAllowBalancedTuning(BALANCED_TUNING_ENABLED && preferences.allowBalancedTuning === true);
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
        setTargets({ ...EMPTY_STAT_TARGETS });
        setSetSelections({});
        setResultSort(DEFAULT_RESULT_SORT);
        invalidateSolve();
        setStatus('idle');
        setMessage('Calculator choices cleared.');
    }

    return (
        <ArmorAppShell
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
                    dumpStat={dumpStat()}
                    allowBalancedTuning={effectiveAllowBalancedTuning()}
                    targets={targets()}
                    targetCaps={targetCaps()}
                    setSelections={setSelections()}
                    availableExotics={availableExotics()}
                    selectableSets={selectableSets()}
                    canSolve={Boolean(normalizedProfile()) && status() !== 'loading'}
                    solving={status() === 'loading' || status() === 'solving'}
                    onCharacterSelect={selectCharacter}
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
