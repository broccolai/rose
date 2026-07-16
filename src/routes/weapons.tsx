import { styled } from '@panda/jsx';
import type {
    SavedWeaponRoll,
    WeaponCatalog,
    WeaponDefinition,
    WeaponEffectOption,
    WeaponEngineCalculation,
    WeaponFilterState,
    WeaponMode,
    WeaponScenario,
    WeaponSelection
} from '@rose/weapon-model';
import { CURRENT_GUARDIAN_HEALTH, calculateWeapon, clampNumber, clampWeaponEffectValue } from '@rose/weapon-model';
import { useLocation } from '@solidjs/router';
import AlertTriangle from 'lucide-solid/icons/alert-triangle';
import LoaderCircle from 'lucide-solid/icons/loader-circle';
import RefreshCw from 'lucide-solid/icons/refresh-cw';
import { createEffect, createMemo, createSignal, onCleanup, onMount, Show, untrack } from 'solid-js';
import { type AppTheme, DEFAULT_APP_THEME, sanitizeAppTheme } from '@/features/armor/app-theme';
import { readCalculatorPreferences, writeCalculatorPreferences } from '@/features/armor/calculator-preferences';
import {
    calculateManifestStats,
    createDefaultSelection,
    loadWeaponCatalog,
    plugChoicesForSocket,
    reconcileSelection,
    selectedPlugHashes
} from '@/features/weapons/catalog';
import { addWeaponCompare, readWeaponCompare, writeWeaponCompare } from '@/features/weapons/compare-library';
import { AnalysisPanel } from '@/features/weapons/components/analysis-panel';
import { WeaponAppShell } from '@/features/weapons/components/app-shell';
import { RollEditor } from '@/features/weapons/components/roll-editor';
import { WeaponSearch } from '@/features/weapons/components/weapon-search';
import { WeaponToolbar } from '@/features/weapons/components/weapon-toolbar';
import { EMPTY_WEAPON_FILTERS, filterWeapons, primeWeaponSearch, rankWeaponResults } from '@/features/weapons/search';
import { decodeWeaponScenario, decodeWeaponSelection, encodeWeaponSelection, selectionUrl } from '@/features/weapons/selection-url';

const DEFAULT_WEAPON_HASH = 1041028434;
const SEARCH_RESULT_LIMIT = 24;

const StatePane = styled('div', {
    base: {
        display: 'grid',
        placeItems: 'center',
        alignContent: 'center',
        gap: '0.55rem',
        minH: { base: '14rem', md: '100%' },
        p: '1.5rem',
        color: 'var(--rose-muted)',
        fontSize: '0.76rem',
        textAlign: 'center',
        '& svg': { w: '1.1rem', h: '1.1rem' },
        '&[data-loading="true"] > svg': { animation: 'rose-spin 900ms linear infinite' },
        '& button': {
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            minH: '2.15rem',
            px: '0.7rem',
            border: '1px solid var(--rose-border)',
            borderRadius: 'var(--rose-radius-sm)',
            bg: 'var(--rose-surface-soft)',
            color: 'var(--rose-muted-strong)',
            fontSize: '0.68rem',
            fontWeight: 750,
            '& svg': { w: '0.85rem', h: '0.85rem' }
        }
    }
});

function CatalogState(props: { error: string; loadingLabel: string; onRetry: () => void }) {
    return (
        <StatePane data-loading={!props.error} role={props.error ? 'alert' : 'status'} aria-live={props.error ? 'assertive' : 'polite'}>
            {props.error ? <AlertTriangle aria-hidden="true" /> : <LoaderCircle aria-hidden="true" />}
            <span>{props.error || props.loadingLabel}</span>
            <Show when={props.error}>
                <button type="button" onClick={props.onRetry}>
                    <RefreshCw aria-hidden="true" />
                    Retry
                </button>
            </Show>
        </StatePane>
    );
}

export default function WeaponsPage() {
    const location = useLocation();
    let calculationRequest = 0;
    let copiedTimer: ReturnType<typeof setTimeout> | undefined;
    let browserReady = false;
    const [catalog, setCatalog] = createSignal<WeaponCatalog | null>(null);
    const [catalogError, setCatalogError] = createSignal('');
    const [filters, setFilters] = createSignal<WeaponFilterState>({ ...EMPTY_WEAPON_FILTERS });
    const [selection, setSelection] = createSignal<WeaponSelection | null>(null);
    const [mode, setMode] = createSignal<WeaponMode>('pvp');
    const [calculation, setCalculation] = createSignal<WeaponEngineCalculation | null>(null);
    const [effectOptions, setEffectOptions] = createSignal<Record<string, WeaponEffectOption>>({});
    const [effectOptionsWeaponHash, setEffectOptionsWeaponHash] = createSignal<number | null>(null);
    const [calculationStatus, setCalculationStatus] = createSignal<'idle' | 'loading' | 'ready' | 'error'>('idle');
    const [overshield, setOvershieldSignal] = createSignal(0);
    const [weaponsStat, setWeaponsStatSignal] = createSignal(100);
    const [theme, setTheme] = createSignal<AppTheme>(DEFAULT_APP_THEME);
    const [copied, setCopied] = createSignal(false);
    const [compareRolls, setCompareRolls] = createSignal<SavedWeaponRoll[]>([]);
    const [compareError, setCompareError] = createSignal('');

    const selectedWeapon = createMemo(() => {
        const currentCatalog = catalog();
        const currentSelection = selection();
        return currentCatalog && currentSelection
            ? (currentCatalog.weapons.find((weapon) => weapon.hash === currentSelection.weaponHash) ?? null)
            : null;
    });
    const allFilteredWeapons = createMemo(() => {
        const currentCatalog = catalog();
        const currentFilters = filters();
        return currentCatalog ? rankWeaponResults(filterWeapons(currentCatalog, currentFilters), currentFilters.query) : [];
    });
    const visibleWeapons = createMemo(() => (filters().query.trim() ? allFilteredWeapons().slice(0, SEARCH_RESULT_LIMIT) : []));
    const scenario = createMemo<WeaponScenario>(() => ({
        mode: mode(),
        overshield: overshield(),
        weaponsStat: weaponsStat()
    }));

    onMount(() => {
        browserReady = true;
        const previousTitle = document.title;
        document.title = 'Rose Weapons';
        const initialTheme = sanitizeAppTheme(readCalculatorPreferences()?.appTheme);
        applyTheme(initialTheme);
        setCompareRolls(readWeaponCompare());

        const handlePopState = () => applyUrlSelection(catalog());
        window.addEventListener('popstate', handlePopState);
        onCleanup(() => {
            window.removeEventListener('popstate', handlePopState);
            document.title = previousTitle;
        });

        void refreshCatalog();
    });

    createEffect(() => {
        const current = selection();
        const pathname = location.pathname;
        if (!browserReady || !current || !/^\/weapons\/?$/.test(pathname)) return;
        const params = encodeWeaponSelection(current, scenario());
        untrack(() => window.history.replaceState(window.history.state, '', `/weapons?${params.toString()}`));
    });

    createEffect(() => {
        const currentCatalog = catalog();
        const weapon = selectedWeapon();
        const currentSelection = selection();
        const currentMode = mode();
        const currentOvershield = overshield();
        const currentWeaponsStat = weaponsStat();
        if (!currentCatalog || !weapon || !currentSelection) return;

        const request = ++calculationRequest;
        if (effectOptionsWeaponHash() !== weapon.hash) {
            setEffectOptions({});
            setEffectOptionsWeaponHash(weapon.hash);
        }
        setCalculation(null);
        setCalculationStatus('loading');
        void calculateWeapon({
            catalog: currentCatalog,
            weapon,
            selection: currentSelection,
            mode: currentMode,
            targetHealth: CURRENT_GUARDIAN_HEALTH,
            overshield: currentOvershield,
            weaponsStat: currentWeaponsStat
        })
            .then((next) => {
                if (request !== calculationRequest) return;
                setEffectOptions(next.effectOptions);
                setEffectOptionsWeaponHash(weapon.hash);
                const normalizedEffects = normalizeSelectionEffects(weapon, currentSelection, next.effectOptions);
                if (!recordsEqual(normalizedEffects, currentSelection.effects)) {
                    setSelection({ ...currentSelection, effects: normalizedEffects });
                    return;
                }
                setCalculation(next);
                setCalculationStatus('ready');
            })
            .catch((error: unknown) => {
                if (request !== calculationRequest) return;
                console.error('Weapon calculation failed', error);
                setCalculation(null);
                setCalculationStatus('error');
            });
    });

    onCleanup(() => {
        browserReady = false;
        calculationRequest += 1;
        if (copiedTimer) clearTimeout(copiedTimer);
    });

    async function refreshCatalog() {
        setCatalogError('');
        try {
            const loaded = await loadWeaponCatalog();
            if (loaded.weapons.length === 0) throw new Error('Weapon catalog is empty.');
            setCatalog(loaded);
            primeWeaponSearch(loaded);
            applyUrlSelection(loaded);
        } catch (error: unknown) {
            setCatalogError(error instanceof Error ? error.message : 'Weapon catalog failed to load.');
        }
    }

    function applyUrlSelection(currentCatalog: WeaponCatalog | null) {
        if (!currentCatalog) return;
        const params = new URLSearchParams(window.location.search);
        const requested = decodeWeaponSelection(params);
        const requestedScenario = decodeWeaponScenario(params);
        const weapon = requested
            ? currentCatalog.weapons.find((candidate) => candidate.hash === requested.weaponHash)
            : currentCatalog.weapons.find((candidate) => candidate.hash === DEFAULT_WEAPON_HASH);
        const fallback =
            weapon ?? currentCatalog.weapons.find((candidate) => candidate.rarity === 'legendary') ?? currentCatalog.weapons[0];
        if (!fallback) return;
        setMode(requestedScenario.mode);
        setOvershieldSignal(requestedScenario.overshield);
        setWeaponsStatSignal(requestedScenario.weaponsStat);
        setSelection(
            requested && requested.weaponHash === fallback.hash
                ? reconcileSelection(currentCatalog, fallback, requested)
                : createDefaultSelection(currentCatalog, fallback)
        );
    }

    function changeFilters(next: Partial<WeaponFilterState>) {
        setFilters((current) => ({ ...current, ...next }));
    }

    function chooseWeapon(weapon: WeaponDefinition) {
        const currentCatalog = catalog();
        if (!currentCatalog) return;
        setSelection(createDefaultSelection(currentCatalog, weapon));
        if (window.matchMedia('(max-width: 47.999rem)').matches) {
            requestAnimationFrame(() => {
                const editor = document.getElementById('weapon-editor');
                editor?.focus({ preventScroll: true });
                editor?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        }
    }

    function changePlug(socketIndex: number, plugHash: number) {
        setSelection((current) => {
            if (!current) return current;
            const oldHash = current.plugs[String(socketIndex)];
            const effects = { ...current.effects };
            if (oldHash) delete effects[String(oldHash)];
            return { ...current, plugs: { ...current.plugs, [String(socketIndex)]: plugHash }, effects };
        });
    }

    function changeEffect(plugHash: number, value: number) {
        setSelection((current) => {
            if (!current) return current;
            const effects = { ...current.effects };
            const normalized = clampWeaponEffectValue(effectOptions()[String(plugHash)], value);
            if (normalized === 0) delete effects[String(plugHash)];
            else effects[String(plugHash)] = normalized;
            return { ...current, effects };
        });
    }

    function resetRoll() {
        const currentCatalog = catalog();
        const weapon = selectedWeapon();
        if (currentCatalog && weapon) setSelection(createDefaultSelection(currentCatalog, weapon));
    }

    function randomizeRoll() {
        const currentCatalog = catalog();
        const weapon = selectedWeapon();
        if (!currentCatalog || !weapon) return;
        setSelection({
            weaponHash: weapon.hash,
            plugs: Object.fromEntries(
                weapon.sockets.flatMap((socket) => {
                    const choices = plugChoicesForSocket(currentCatalog, socket);
                    const choice = choices[randomIndex(choices.length)];
                    return choice ? [[String(socket.index), choice.hash]] : [];
                })
            ),
            effects: {}
        });
    }

    async function copyShareLink() {
        const current = selection();
        if (!current) return;
        try {
            await navigator.clipboard.writeText(selectionUrl(current, window.location, scenario()));
            setCopied(true);
            if (copiedTimer) clearTimeout(copiedTimer);
            copiedTimer = setTimeout(() => setCopied(false), 1500);
        } catch {
            setCopied(false);
        }
    }

    function pinCurrentRoll() {
        const currentCatalog = catalog();
        const weapon = selectedWeapon();
        const currentSelection = selection();
        const currentCalculation = calculation();
        if (!currentCatalog || !weapon || !currentSelection || !currentCalculation || calculationStatus() !== 'ready') return;
        const selectedNames = selectedPlugHashes(weapon, currentSelection)
            .map((hash) => currentCatalog.plugs[String(hash)]?.name)
            .filter((name): name is string => Boolean(name));
        const stats = currentCalculation?.stats;
        const roll: SavedWeaponRoll = {
            id: encodeWeaponSelection(currentSelection, scenario()).toString(),
            selection: structuredClone(currentSelection),
            weaponName: weapon.name,
            icon: weapon.icon,
            subtitle: `${weapon.type} · ${weapon.intrinsicName}`,
            perkNames: selectedNames,
            stats: Object.fromEntries(
                stats
                    ? stats.map((stat) => [stat.name, stat.total])
                    : calculateManifestStats(currentCatalog, weapon, currentSelection).map((stat) => [stat.name, stat.value])
            ),
            optimalTtk: currentCalculation.ttk?.optimalTtk?.timeTaken ?? null,
            range: currentCalculation?.range?.adsStart ?? null,
            scenario: { ...scenario() },
            engineVersion: currentCalculation?.engineVersion ?? 'manifest-only',
            savedAt: Date.now()
        };
        updateCompare(addWeaponCompare(compareRolls(), roll));
    }

    function loadSavedRoll(roll: SavedWeaponRoll) {
        const currentCatalog = catalog();
        if (!currentCatalog) return;
        const weapon = currentCatalog.weapons.find((candidate) => candidate.hash === roll.selection.weaponHash);
        if (!weapon) return;
        setMode(roll.scenario.mode);
        setOvershieldSignal(roll.scenario.overshield);
        setWeaponsStatSignal(roll.scenario.weaponsStat);
        setSelection(reconcileSelection(currentCatalog, weapon, roll.selection));
    }

    function removeSavedRoll(id: string) {
        updateCompare(compareRolls().filter((roll) => roll.id !== id));
    }

    function moveSavedRoll(index: number, direction: -1 | 1) {
        const nextIndex = index + direction;
        const next = [...compareRolls()];
        if (nextIndex < 0 || nextIndex >= next.length) return;
        [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
        updateCompare(next);
    }

    function updateCompare(next: SavedWeaponRoll[]) {
        setCompareRolls(next);
        setCompareError(writeWeaponCompare(next) ? '' : 'Pinned rolls could not be saved in this browser.');
    }

    function applyTheme(nextTheme: AppTheme) {
        setTheme(nextTheme);
        document.documentElement.dataset['theme'] = nextTheme;
        writeCalculatorPreferences({ ...(readCalculatorPreferences() ?? {}), appTheme: nextTheme });
    }

    function navigateToArmor(event: MouseEvent) {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        browserReady = false;
        calculationRequest += 1;
    }

    return (
        <WeaponAppShell
            toolbar={
                <WeaponToolbar
                    search={
                        <WeaponSearch
                            filters={filters()}
                            weapons={visibleWeapons()}
                            total={allFilteredWeapons().length}
                            selectedHash={selection()?.weaponHash}
                            loading={!catalog() && !catalogError()}
                            error={catalogError()}
                            onFiltersChange={changeFilters}
                            onClearFilters={() => changeFilters({ ...EMPTY_WEAPON_FILTERS })}
                            onRetry={refreshCatalog}
                            onSelect={chooseWeapon}
                        />
                    }
                    theme={theme()}
                    copied={copied()}
                    compareCount={compareRolls().length}
                    disabled={!selection()}
                    pinDisabled={!selection() || calculationStatus() !== 'ready'}
                    onThemeChange={applyTheme}
                    onShare={copyShareLink}
                    onRandomize={randomizeRoll}
                    onReset={resetRoll}
                    onPin={pinCurrentRoll}
                    onNavigateAway={navigateToArmor}
                />
            }
            editor={
                <Show
                    when={catalog() && selectedWeapon() && selection()}
                    fallback={<CatalogState error={catalogError()} loadingLabel="Loading roll editor" onRetry={refreshCatalog} />}
                >
                    <RollEditor
                        catalog={catalog() as WeaponCatalog}
                        weapon={selectedWeapon() as WeaponDefinition}
                        selection={selection() as WeaponSelection}
                        calculation={calculation()}
                        effectOptions={effectOptions()}
                        calculationStatus={calculationStatus()}
                        mode={mode()}
                        onModeChange={setMode}
                        onPlugChange={changePlug}
                        onEffectChange={changeEffect}
                    />
                </Show>
            }
            analysis={
                <Show
                    when={catalog()}
                    fallback={<CatalogState error={catalogError()} loadingLabel="Loading calculations" onRetry={refreshCatalog} />}
                >
                    {(loaded) => (
                        <AnalysisPanel
                            catalog={loaded()}
                            calculation={calculation()}
                            calculationStatus={calculationStatus()}
                            mode={mode()}
                            overshield={overshield()}
                            weaponsStat={weaponsStat()}
                            rolls={compareRolls()}
                            compareError={compareError()}
                            onOvershieldChange={(value) => setOvershieldSignal(Math.round(clampNumber(value, 0, 100)))}
                            onWeaponsStatChange={(value) => setWeaponsStatSignal(Math.round(clampNumber(value, 100, 200)))}
                            onLoadRoll={loadSavedRoll}
                            onRemoveRoll={removeSavedRoll}
                            onMoveRoll={moveSavedRoll}
                        />
                    )}
                </Show>
            }
        />
    );
}

function randomIndex(length: number) {
    if (length <= 1) return 0;
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return (values[0] ?? 0) % length;
}

function normalizeSelectionEffects(weapon: WeaponDefinition, selection: WeaponSelection, options: Record<string, WeaponEffectOption>) {
    const hashes = [...(weapon.intrinsicHash ? [weapon.intrinsicHash] : []), ...Object.values(selection.plugs)];
    return Object.fromEntries(
        hashes.flatMap((hash) => {
            const value = clampWeaponEffectValue(options[String(hash)], selection.effects[String(hash)] ?? 0);
            return value > 0 ? [[String(hash), value]] : [];
        })
    );
}

function recordsEqual(left: Record<string, number>, right: Record<string, number>) {
    const leftEntries = Object.entries(left);
    const rightEntries = Object.entries(right);
    return (
        leftEntries.length === rightEntries.length && leftEntries.every(([key, value]) => Object.hasOwn(right, key) && right[key] === value)
    );
}
