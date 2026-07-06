import { ARMOR_STATS, type ArmorBuild, type ArmorBuildSort, type ArmorStat } from '@armor-calc';
import { css } from '@panda/css';
import { For, type JSX, Show } from 'solid-js';

import { MONO_FONT_FAMILY } from '@/features/armor/components/ui-styles';
import { STAT_LABELS } from '@/features/armor/display-metadata';
import { type ArmorBonusDefinitionSet, buildExpansionKey, getArmorBonusDisplays } from '@/features/armor/result-display';

export type VisibleResultSortKey = ArmorStat | 'totalStats';

type ResultsTableProps = {
    builds: ArmorBuild[];
    armorSets: ArmorBonusDefinitionSet[];
    dumpStat: ArmorStat | '';
    expandedBuildKey: string | null;
    sort: ArmorBuildSort;
    visibleLimit: number;
    onSort: (key: VisibleResultSortKey) => void;
    onToggleBuild: (build: ArmorBuild) => void;
    renderExpandedBuild: (build: ArmorBuild, index: number) => JSX.Element;
};

const RESULT_COLUMN_COUNT = 8;

const tableWrap = css({
    w: '100%',
    maxW: '100%',
    minW: 0,
    overflowX: 'hidden',
    overflowY: 'auto',
    maxH: { base: '28rem', lg: 'calc(100vh - 16rem)' },
    scrollbarGutter: 'stable',
    border: '1px solid var(--rose-border)',
    borderRadius: '0.85rem',
    bg: 'var(--rose-surface)'
});

const tinyMuted = css({
    color: 'var(--rose-muted)',
    fontFamily: MONO_FONT_FAMILY,
    fontSize: '0.68rem',
    lineHeight: 1.35,
    letterSpacing: 0
});

const sortButton = css({
    border: 0,
    bg: 'transparent',
    color: 'inherit',
    font: 'inherit',
    fontWeight: 700,
    p: 0,
    cursor: 'pointer',
    whiteSpace: 'normal',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '2px',
    w: '100%'
});

const table = css({
    w: '100%',
    minW: 0,
    tableLayout: 'fixed',
    borderCollapse: 'collapse',
    fontFamily: MONO_FONT_FAMILY,
    fontSize: '0.74rem',
    '& th': {
        textAlign: 'left',
        borderBottom: '1px solid var(--rose-border)',
        bg: '#0a0a0c',
        p: '8px 6px',
        color: 'var(--rose-muted)',
        whiteSpace: 'normal',
        lineHeight: 1.05,
        letterSpacing: 0,
        fontWeight: 680
    },
    '& thead th': {
        position: 'sticky',
        top: 0,
        zIndex: 2
    },
    '& td': {
        borderBottom: '1px solid var(--rose-border)',
        p: '8px 6px',
        verticalAlign: 'middle',
        lineHeight: 1.2,
        h: '42px'
    },
    '& th[data-numeric], & td[data-numeric]': {
        textAlign: 'right',
        fontVariantNumeric: 'tabular-nums'
    },
    '& td[data-text-cell]': {
        minW: 0,
        overflowWrap: 'anywhere',
        wordBreak: 'normal'
    },
    '& tr[data-clickable="true"]': {
        cursor: 'pointer'
    },
    '& tr[data-expanded="true"]': {
        bg: 'var(--rose-surface-raised)'
    },
    '& tr[data-expanded="true"] td:first-child': {
        boxShadow: 'inset 3px 0 0 var(--rose-accent)'
    },
    '& tbody tr:hover': {
        bg: 'var(--rose-surface-soft)'
    }
});

const expandedDetailRow = css({
    '&:hover': {
        bg: 'transparent'
    }
});

const expandedDetailCell = css({
    h: 'auto!',
    p: '0!',
    bg: 'var(--rose-surface)',
    borderBottom: '1px solid var(--rose-border)'
});

const expandedDetailInner = css({
    p: 0,
    bg: 'var(--rose-surface)'
});

const bonusText = css({
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.25rem',
    minW: 0
});

const bonusChip = css({
    display: 'inline-flex',
    alignItems: 'center',
    maxW: '100%',
    minH: '20px',
    px: '0.42rem',
    border: '1px solid color-mix(in srgb, var(--rose-success) 52%, var(--rose-border))',
    borderRadius: '999px',
    color: 'var(--rose-success)',
    bg: 'color-mix(in srgb, var(--rose-success) 10%, var(--rose-surface))',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: '0.68rem',
    fontWeight: 720,
    '&[data-op="true"]': {
        borderColor: 'color-mix(in srgb, #d9b45f 62%, var(--rose-border))',
        color: '#e5c36d',
        bg: 'color-mix(in srgb, #d9b45f 12%, var(--rose-surface))',
        boxShadow: 'inset 0 0 12px color-mix(in srgb, #d9b45f 12%, transparent)'
    }
});

const mutedDash = css({
    color: 'var(--rose-muted)'
});

function SortableHeader(props: { label: string; mark: string; numeric?: boolean; title?: string; onClick: () => void }) {
    return (
        <th data-numeric={props.numeric} title={props.title}>
            <button class={sortButton} type="button" aria-label={`Sort by ${props.title ?? props.label}`} onClick={props.onClick}>
                {props.label}
                {props.mark}
            </button>
        </th>
    );
}

function BonusSummary(props: { build: ArmorBuild; armorSets: ArmorBonusDefinitionSet[] }) {
    const bonuses = () => getArmorBonusDisplays(props.build, props.armorSets);

    return (
        <div class={bonusText}>
            <Show when={bonuses().length > 0} fallback={<span class={mutedDash}>-</span>}>
                <For each={bonuses()}>
                    {(bonus) => (
                        <span class={bonusChip} data-op={bonus.isOp} title={bonus.title}>
                            {bonus.label}
                        </span>
                    )}
                </For>
            </Show>
        </div>
    );
}

function ResultRow(props: {
    build: ArmorBuild;
    armorSets: ArmorBonusDefinitionSet[];
    dumpStat: ArmorStat | '';
    expanded: boolean;
    onToggle: () => void;
}) {
    return (
        <tr
            data-clickable="true"
            data-expanded={props.expanded}
            tabIndex={0}
            onClick={props.onToggle}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    props.onToggle();
                }
            }}
        >
            <For each={ARMOR_STATS}>
                {(stat) => (
                    <td data-numeric class={props.dumpStat === stat ? tinyMuted : undefined}>
                        {props.build.stats[stat]}
                    </td>
                )}
            </For>
            <td data-numeric>{props.build.score.totalStats}</td>
            <td data-text-cell>
                <BonusSummary build={props.build} armorSets={props.armorSets} />
            </td>
        </tr>
    );
}

export function ResultsTable(props: ResultsTableProps) {
    function sortMark(key: VisibleResultSortKey) {
        if (props.sort.key !== key) {
            return '';
        }

        return '';
    }

    return (
        <div class={tableWrap}>
            <table class={table}>
                <colgroup>
                    <For each={ARMOR_STATS}>{() => <col style={{ width: '9.6%' }} />}</For>
                    <col style={{ width: '9.2%' }} />
                    <col style={{ width: '33.2%' }} />
                </colgroup>
                <thead>
                    <tr>
                        <For each={ARMOR_STATS}>
                            {(stat) => (
                                <SortableHeader
                                    label={STAT_LABELS[stat]}
                                    mark={sortMark(stat)}
                                    numeric
                                    title={STAT_LABELS[stat]}
                                    onClick={() => props.onSort(stat)}
                                />
                            )}
                        </For>
                        <SortableHeader
                            label="Total"
                            mark={sortMark('totalStats')}
                            numeric
                            title="total stats"
                            onClick={() => props.onSort('totalStats')}
                        />
                        <th>Bonuses</th>
                    </tr>
                </thead>
                <tbody>
                    <For each={props.builds.slice(0, props.visibleLimit)}>
                        {(build, index) => (
                            <>
                                <ResultRow
                                    build={build}
                                    armorSets={props.armorSets}
                                    dumpStat={props.dumpStat}
                                    expanded={props.expandedBuildKey === buildExpansionKey(build)}
                                    onToggle={() => props.onToggleBuild(build)}
                                />
                                <Show when={props.expandedBuildKey === buildExpansionKey(build)}>
                                    <tr class={expandedDetailRow}>
                                        <td class={expandedDetailCell} colSpan={RESULT_COLUMN_COUNT}>
                                            <div class={expandedDetailInner}>{props.renderExpandedBuild(build, index())}</div>
                                        </td>
                                    </tr>
                                </Show>
                            </>
                        )}
                    </For>
                </tbody>
            </table>
        </div>
    );
}
