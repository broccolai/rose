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

import type { AvailableArmorSet } from '@/features/armor/calculator-view-model';
import { ResultsTable, type VisibleResultSortKey } from '@/features/armor/components/results-table';
import { MONO_FONT_FAMILY, muted } from '@/features/armor/components/ui-styles';
import { SLOT_LABELS } from '@/features/armor/display-metadata';
import { type ArmorSetDisplayMode, buildExpansionKey, formatDimArmorQuery } from '@/features/armor/result-display';

type ResultsPanelProps = {
    result: SolveArmorResult | null;
    builds: ArmorBuild[];
    armorSets: AvailableArmorSet[];
    armorSetDisplayMode: ArmorSetDisplayMode;
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

const resultsTitle = css({
    m: 0,
    fontFamily: MONO_FONT_FAMILY,
    fontSize: '1.05rem',
    lineHeight: 1,
    fontWeight: 780,
    color: 'var(--rose-text)'
});

const headerTools = css({
    display: 'flex',
    alignItems: 'center',
    gap: '0.55rem 0.75rem',
    flexWrap: 'wrap',
    justifyContent: { base: 'flex-start', lg: 'flex-end' },
    minW: 0
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
    bg: 'var(--rose-surface)',
    p: 0
});

const detailTableWrap = css({
    w: '100%',
    maxW: '100%',
    overflowX: 'hidden',
    borderTop: '1px solid var(--rose-border)'
});

const detailActions = css({
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '0.75rem',
    p: '14px',
    borderTop: '1px solid var(--rose-border)',
    bg: 'color-mix(in srgb, var(--rose-surface-soft) 36%, var(--rose-surface))',
    '@media (max-width: 560px)': {
        gridTemplateColumns: '1fr'
    }
});

const detailActionButton = css({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    w: '100%',
    minH: '44px',
    px: '1rem',
    border: '1px solid color-mix(in srgb, var(--rose-accent) 28%, var(--rose-border))',
    borderRadius: '0.7rem',
    bg: 'color-mix(in srgb, var(--rose-accent) 7%, var(--rose-surface-raised))',
    color: 'var(--rose-text)',
    fontFamily: MONO_FONT_FAMILY,
    fontSize: '0.82rem',
    fontWeight: 760,
    lineHeight: 1,
    letterSpacing: 0,
    cursor: 'pointer',
    boxShadow: 'inset 0 1px 0 color-mix(in srgb, white 5%, transparent)',
    transition: 'background-color 120ms ease, border-color 120ms ease, color 120ms ease, opacity 120ms ease',
    _hover: {
        bg: 'color-mix(in srgb, var(--rose-accent) 14%, var(--rose-surface-raised))',
        borderColor: 'color-mix(in srgb, var(--rose-accent) 52%, var(--rose-border))'
    },
    _focusVisible: {
        outline: '2px solid color-mix(in srgb, var(--rose-accent) 34%, transparent)',
        outlineOffset: '2px'
    },
    _disabled: {
        opacity: 0.5,
        cursor: 'not-allowed',
        _hover: {
            bg: 'color-mix(in srgb, var(--rose-accent) 7%, var(--rose-surface-raised))',
            borderColor: 'color-mix(in srgb, var(--rose-accent) 28%, var(--rose-border))'
        }
    }
});

const detailTable = css({
    w: '100%',
    minW: 0,
    tableLayout: 'fixed',
    borderCollapse: 'collapse',
    fontFamily: MONO_FONT_FAMILY,
    fontSize: '0.74rem',
    '& th': {
        p: '7px 8px',
        color: 'var(--rose-muted)',
        bg: '#0a0a0c',
        borderBottom: '1px solid var(--rose-border)',
        textAlign: 'left',
        fontWeight: 720,
        lineHeight: 1.15
    },
    '& td': {
        p: '8px',
        borderBottom: '1px solid var(--rose-border)',
        bg: 'color-mix(in srgb, var(--rose-surface-soft) 62%, transparent)',
        lineHeight: 1.2,
        verticalAlign: 'middle'
    },
    '& tbody tr:last-child td': {
        borderBottom: 0
    },
    '& td[data-muted]': {
        color: 'var(--rose-muted)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
    }
});

const pieceName = css({
    minW: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontWeight: 720
});

function addonName(build: ArmorBuild, slot: ArmorSlot, addonKey: 'statMod' | 'tuning') {
    const addon = build.pieces[slot][addonKey];
    return addon && ARMOR_STATS.some((stat) => (addon.deltas[stat] ?? 0) !== 0) ? addon.name : '-';
}

async function copyTextToClipboard(text: string) {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.append(textarea);
    textarea.select();

    try {
        document.execCommand('copy');
    } finally {
        textarea.remove();
    }
}

function BuildDetail(props: { build: ArmorBuild; showTuningResults: boolean }) {
    const [copyState, setCopyState] = createSignal<'idle' | 'copied' | 'failed'>('idle');

    async function copyDimQuery() {
        try {
            await copyTextToClipboard(formatDimArmorQuery(props.build));
            setCopyState('copied');
            window.setTimeout(() => setCopyState('idle'), 1400);
        } catch {
            setCopyState('failed');
            window.setTimeout(() => setCopyState('idle'), 1800);
        }
    }

    const copyLabel = () => {
        if (copyState() === 'copied') {
            return 'Copied';
        }

        if (copyState() === 'failed') {
            return 'Copy failed';
        }

        return 'Copy DIM Query';
    };

    return (
        <div class={detailPanel}>
            <div class={detailTableWrap}>
                <table class={detailTable}>
                    <colgroup>
                        <col style={{ width: '92px' }} />
                        <col style={{ width: 'auto' }} />
                        <col style={{ width: '126px' }} />
                        <Show when={props.showTuningResults}>
                            <col style={{ width: '142px' }} />
                        </Show>
                    </colgroup>
                    <thead>
                        <tr>
                            <th>Slot</th>
                            <th>Armor</th>
                            <th>Mod</th>
                            <Show when={props.showTuningResults}>
                                <th>Tuning</th>
                            </Show>
                        </tr>
                    </thead>
                    <tbody>
                        <For each={ARMOR_SLOTS}>
                            {(slot) => {
                                const piece = () => props.build.pieces[slot];
                                return (
                                    <tr>
                                        <td data-muted>{SLOT_LABELS[slot]}</td>
                                        <td>
                                            <span class={pieceName} title={piece().item.name}>
                                                {piece().item.name}
                                            </span>
                                        </td>
                                        <td data-muted>{addonName(props.build, slot, 'statMod')}</td>
                                        <Show when={props.showTuningResults}>
                                            <td data-muted>{addonName(props.build, slot, 'tuning')}</td>
                                        </Show>
                                    </tr>
                                );
                            }}
                        </For>
                    </tbody>
                </table>
                <div class={detailActions}>
                    <button class={detailActionButton} type="button" onClick={copyDimQuery}>
                        {copyLabel()}
                    </button>
                    <button class={detailActionButton} type="button" disabled title="Equip item support is not wired yet.">
                        Equip Items
                    </button>
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

    return (
        <div class={resultsShell}>
            <div class={resultsHeader}>
                <h2 class={resultsTitle}>Results</h2>
                <div class={headerTools}>
                    <Show when={props.result?.ok}>
                        <span class={tinyMuted}>{resultCountLabel()}</span>
                    </Show>
                </div>
            </div>
            <Show when={props.loading}>
                <div class={stateCard}>
                    <h3>Loading</h3>
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
                            armorSets={props.armorSets}
                            armorSetDisplayMode={props.armorSetDisplayMode}
                            dumpStat={props.dumpStat}
                            expandedBuildKey={expandedBuildKey()}
                            sort={props.sort}
                            visibleLimit={props.visibleLimit}
                            onSort={props.onSort}
                            onToggleBuild={toggleExpandedBuild}
                            renderExpandedBuild={(build) => <BuildDetail build={build} showTuningResults={props.showTuningResults} />}
                        />
                    </Show>
                </Show>
            </Show>
        </div>
    );
}
