import {
    ARMOR_SLOTS,
    ARMOR_STATS,
    type ArmorBuild,
    type ArmorBuildSort,
    type ArmorSlot,
    type ArmorStat,
    type SolveArmorResult
} from '@armor-calc';
import { css } from '@panda/css';
import { createSignal, For, Show } from 'solid-js';

import { ResultsTable, type VisibleResultSortKey } from '@/features/armor/components/results-table';
import { input, MONO_FONT_FAMILY, muted, sectionTitle } from '@/features/armor/components/ui-styles';
import { SLOT_LABELS, STAT_LABELS } from '@/features/armor/display-metadata';
import { buildExpansionKey } from '@/features/armor/result-display';

type ResultsPanelProps = {
    result: SolveArmorResult | null;
    builds: ArmorBuild[];
    resultFailure: string | null;
    sort: ArmorBuildSort;
    dumpStat: ArmorStat | '';
    loading: boolean;
    progress: { active: boolean; label: string; current: number; total: number; percent: number };
    showTuningResults: boolean;
    visibleLimit: number;
    onSort: (key: VisibleResultSortKey) => void;
};

const resultsShell = css({
    maxW: 'none',
    mx: 'auto',
    w: '100%',
    display: 'grid',
    gap: '1rem'
});

const resultsHeader = css({
    display: 'grid',
    gridTemplateColumns: { base: 'minmax(0, 1fr)', lg: 'auto minmax(0, 1fr)' },
    alignItems: 'center',
    gap: '0.65rem 1rem',
    mb: '0.8rem'
});

const headerTools = css({
    display: 'flex',
    alignItems: 'center',
    gap: '0.55rem 0.75rem',
    flexWrap: 'wrap',
    justifyContent: { base: 'flex-start', lg: 'flex-end' },
    minW: 0
});

const sortSelect = css({
    w: { base: '100%', sm: '13rem' },
    minH: '34px',
    fontSize: '0.78rem'
});

const emptyState = css({
    minH: '8rem',
    display: 'grid',
    placeItems: 'center',
    border: '1px solid var(--rose-border)',
    borderRadius: '0.85rem',
    bg: 'var(--rose-surface)',
    p: '1.25rem',
    '& p': {
        m: 0
    }
});

const tinyMuted = css({
    color: 'var(--rose-muted)',
    fontFamily: MONO_FONT_FAMILY,
    fontSize: '0.72rem',
    lineHeight: 1.35,
    letterSpacing: 0
});

const stateCard = css({
    minH: '8rem',
    display: 'grid',
    alignContent: 'center',
    gap: '0.45rem',
    border: '1px solid var(--rose-border)',
    borderRadius: '0.85rem',
    bg: 'var(--rose-surface)',
    p: '1.25rem',
    '& h3': {
        m: 0,
        color: 'var(--rose-text)',
        fontSize: '0.98rem',
        fontWeight: 760
    },
    '& p': {
        m: 0
    }
});

const progressTrack = css({
    h: '6px',
    mt: '0.45rem',
    overflow: 'hidden',
    borderRadius: '999px',
    bg: 'var(--rose-surface-soft)'
});

const progressBar = css({
    h: '100%',
    bg: 'var(--rose-accent)'
});

const detailPanel = css({
    display: 'grid',
    gap: '0.85rem',
    border: '1px solid var(--rose-border)',
    borderRadius: '0.85rem',
    bg: 'var(--rose-surface)',
    p: '1rem'
});

const detailHeader = css({
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: '1rem',
    '& h3': {
        m: 0,
        fontSize: '0.98rem',
        fontWeight: 780,
        color: 'var(--rose-text)'
    }
});

const detailGrid = css({
    display: 'grid',
    gridTemplateColumns: { base: 'minmax(0, 1fr)', xl: 'minmax(0, 1.5fr) minmax(17rem, 0.8fr)' },
    gap: '1rem',
    alignItems: 'start',
    minW: 0
});

const pieceList = css({
    display: 'grid',
    gap: '0.45rem'
});

const pieceRow = css({
    display: 'grid',
    gridTemplateColumns: { base: 'minmax(0, 1fr)', md: '5.5rem minmax(0, 1fr) minmax(8rem, 0.7fr)' },
    gap: { base: '0.28rem', md: '0.7rem' },
    alignItems: 'center',
    minH: '38px',
    border: '1px solid var(--rose-border)',
    borderRadius: '0.55rem',
    bg: 'var(--rose-surface-soft)',
    px: '0.65rem',
    py: '0.45rem',
    '&[data-exotic="true"]': {
        borderColor: 'color-mix(in srgb, var(--rose-exotic) 58%, var(--rose-border))'
    }
});

const pieceName = css({
    minW: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: { base: 'normal', md: 'nowrap' },
    fontWeight: 700
});

const sideCards = css({
    display: 'grid',
    gap: '0.65rem'
});

const detailCard = css({
    display: 'grid',
    gap: '0.45rem',
    border: '1px solid var(--rose-border)',
    borderRadius: '0.65rem',
    bg: 'var(--rose-surface-soft)',
    p: '0.75rem',
    '& h4': {
        m: 0,
        fontSize: '0.82rem',
        fontWeight: 760
    }
});

const chipList = css({
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.35rem'
});

const greenChip = css({
    display: 'inline-flex',
    minH: '22px',
    alignItems: 'center',
    px: '0.5rem',
    borderRadius: '999px',
    border: '1px solid color-mix(in srgb, var(--rose-success) 52%, var(--rose-border))',
    color: 'var(--rose-success)',
    bg: 'color-mix(in srgb, var(--rose-success) 10%, var(--rose-surface))',
    fontSize: '0.72rem',
    fontWeight: 720
});

const exoticTag = css({
    color: 'var(--rose-exotic)',
    fontSize: '0.68rem',
    fontWeight: 760
});

function addonName(build: ArmorBuild, slot: ArmorSlot, addonKey: 'statMod' | 'tuning') {
    const addon = build.pieces[slot][addonKey];
    return addon && ARMOR_STATS.some((stat) => (addon.deltas[stat] ?? 0) !== 0) ? addon.name : '-';
}

function BuildDetail(props: { build: ArmorBuild; index: number; showTuningResults: boolean }) {
    const activeBonuses = () =>
        props.build.activeSetBonuses.map((bonus) => `${bonus.activeBonuses.includes(4) ? '4pc' : '2pc'} ${bonus.name}`);
    const tuningChoices = () =>
        ARMOR_SLOTS.map((slot) => ({ slot, name: addonName(props.build, slot, 'tuning') })).filter((choice) => choice.name !== '-');

    return (
        <div class={detailPanel}>
            <div class={detailHeader}>
                <h3>Build #{props.index + 1}</h3>
                <span class={tinyMuted}>Total {props.build.score.totalStats}</span>
            </div>
            <div class={detailGrid}>
                <div class={pieceList}>
                    <For each={ARMOR_SLOTS}>
                        {(slot) => {
                            const piece = () => props.build.pieces[slot];
                            return (
                                <div class={pieceRow} data-exotic={piece().item.isExotic}>
                                    <span class={tinyMuted}>{SLOT_LABELS[slot]}</span>
                                    <span class={pieceName} title={piece().item.name}>
                                        {piece().item.name}{' '}
                                        <Show when={piece().item.isExotic}>
                                            <span class={exoticTag}>Exotic</span>
                                        </Show>
                                    </span>
                                    <span class={tinyMuted}>{addonName(props.build, slot, 'statMod')}</span>
                                </div>
                            );
                        }}
                    </For>
                </div>
                <div class={sideCards}>
                    <Show when={props.showTuningResults}>
                        <div class={detailCard}>
                            <h4>Tuning</h4>
                            <Show when={tuningChoices().length > 0} fallback={<p class={muted}>No tuning used.</p>}>
                                <div class={chipList}>
                                    <For each={tuningChoices()}>
                                        {(choice) => (
                                            <span class={tinyMuted}>
                                                {SLOT_LABELS[choice.slot]}: {choice.name}
                                            </span>
                                        )}
                                    </For>
                                </div>
                            </Show>
                        </div>
                    </Show>
                    <div class={detailCard}>
                        <h4>Active bonuses</h4>
                        <Show when={activeBonuses().length > 0} fallback={<p class={muted}>No active set bonuses.</p>}>
                            <div class={chipList}>
                                <For each={activeBonuses()}>{(bonus) => <span class={greenChip}>{bonus}</span>}</For>
                            </div>
                        </Show>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function ResultsPanel(props: ResultsPanelProps) {
    const [expandedBuildKey, setExpandedBuildKey] = createSignal<string | null>(null);

    function toggleExpandedBuild(build: ArmorBuild) {
        const key = buildExpansionKey(build);
        setExpandedBuildKey((current) => (current === key ? null : key));
    }

    function resultCountLabel() {
        const result = props.result;
        if (!result?.ok) {
            return '';
        }

        return `${result.validBuildCount} builds found · ${result.returnedBuildCount} retained after pruning`;
    }

    function loadingLabel() {
        if (props.progress.active && props.progress.label) {
            return props.progress.label;
        }

        return 'Solving compatible armor combinations';
    }

    return (
        <div class={resultsShell}>
            <div class={resultsHeader}>
                <h2 class={sectionTitle}>Results</h2>
                <div class={headerTools}>
                    <Show when={props.result?.ok}>
                        <span class={tinyMuted}>{resultCountLabel()}</span>
                        <select
                            class={`${input} ${sortSelect}`}
                            value={props.sort.key === 'wastedStats' ? 'totalStats' : props.sort.key}
                            onChange={(event) => props.onSort(event.currentTarget.value as VisibleResultSortKey)}
                        >
                            <option value="totalStats">Sort by total</option>
                            <For each={ARMOR_STATS}>{(stat) => <option value={stat}>Sort by {STAT_LABELS[stat]}</option>}</For>
                        </select>
                    </Show>
                </div>
            </div>
            <Show when={props.loading}>
                <div class={stateCard}>
                    <h3>{loadingLabel()}</h3>
                    <p class={muted}>Keeping the current layout visible while the profile or solver updates.</p>
                    <Show when={props.progress.active}>
                        <div class={progressTrack}>
                            <div class={progressBar} style={{ width: `${props.progress.percent}%` }} />
                        </div>
                    </Show>
                </div>
            </Show>
            <Show
                when={!props.loading && props.result}
                fallback={
                    <Show when={!props.loading}>
                        <div class={emptyState}>
                            <p class={muted}>Awaiting solve.</p>
                        </div>
                    </Show>
                }
            >
                <Show
                    when={!props.resultFailure}
                    fallback={
                        <div class={stateCard}>
                            <h3>No builds matched these requirements.</h3>
                            <p class={muted}>{props.resultFailure}</p>
                            <p class={muted}>Try changing the exotic, lowering target stats, or clearing the armor set requirement.</p>
                        </div>
                    }
                >
                    <Show
                        when={props.builds.length > 0}
                        fallback={
                            <div class={stateCard}>
                                <h3>No matching armor for this character.</h3>
                                <p class={muted}>Try clearing the exotic or armor set requirements.</p>
                            </div>
                        }
                    >
                        <ResultsTable
                            builds={props.builds}
                            dumpStat={props.dumpStat}
                            expandedBuildKey={expandedBuildKey()}
                            sort={props.sort}
                            visibleLimit={props.visibleLimit}
                            onSort={props.onSort}
                            onToggleBuild={toggleExpandedBuild}
                            renderExpandedBuild={(build, index) => (
                                <BuildDetail build={build} index={index} showTuningResults={props.showTuningResults} />
                            )}
                        />
                    </Show>
                </Show>
            </Show>
        </div>
    );
}
