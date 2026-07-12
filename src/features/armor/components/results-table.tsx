import { ARMOR_STATS, type ArmorBuild, type ArmorBuildSort, type ArmorStat } from '@armor-domain';
import { styled } from '@panda/jsx';
import { For, type JSX, Show } from 'solid-js';

import { DataTable, DataTableFrame } from '@/features/armor/components/data-table';
import { MONO_FONT_FAMILY } from '@/features/armor/components/ui-styles';
import { STAT_LABELS } from '@/features/armor/display-metadata';
import {
    type ArmorBonusDefinitionSet,
    type ArmorSetDisplayMode,
    buildExpansionKey,
    getArmorBonusDisplays
} from '@/features/armor/result-display';

export type VisibleResultSortKey = ArmorStat | 'totalStats';

type ResultsTableProps = {
    builds: ArmorBuild[];
    armorSets: ArmorBonusDefinitionSet[];
    armorSetDisplayMode: ArmorSetDisplayMode;
    dumpStat: ArmorStat | '';
    expandedBuildKey: string | null;
    sort: ArmorBuildSort;
    visibleLimit: number;
    onSort: (key: VisibleResultSortKey) => void;
    onToggleBuild: (build: ArmorBuild) => void;
    renderExpandedBuild: (build: ArmorBuild, index: number) => JSX.Element;
};

const RESULT_COLUMN_COUNT = 8;

const ResultsTableFrame = styled(DataTableFrame, {
    base: {
        w: 'calc(100% + var(--rose-space-sm))',
        maxW: 'none'
    }
});

const SortButton = styled('button', {
    base: {
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
        gap: 'var(--rose-space-xxs)',
        w: '100%'
    }
});

const ExpandedDetailRow = styled('tr', {
    base: {
        '&:hover': {
            bg: 'transparent'
        }
    }
});

const ExpandedDetailCell = styled('td', {
    base: {
        h: 'auto!',
        p: '0!',
        bg: 'var(--rose-surface)',
        borderBottom: '1px solid var(--rose-border)'
    }
});

const ExpandedDetailInner = styled('div', {
    base: {
        p: 0,
        bg: 'var(--rose-surface)'
    }
});

const BonusText = styled('div', {
    base: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 'var(--rose-space-xxs)',
        minW: 0
    }
});

const BonusChip = styled('span', {
    base: {
        display: 'inline-flex',
        alignItems: 'center',
        maxW: '100%',
        minH: '20px',
        px: 'var(--rose-space-xs)',
        border: '1px solid color-mix(in srgb, var(--rose-success) 52%, var(--rose-border))',
        borderRadius: 'var(--rose-radius-sm)',
        color: 'var(--rose-success)',
        bg: 'color-mix(in srgb, var(--rose-success) 10%, var(--rose-surface))',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontSize: '0.68rem',
        fontWeight: 700,
        '&[data-op="true"]': {
            borderColor: 'color-mix(in srgb, #d9b45f 62%, var(--rose-border))',
            color: '#e5c36d',
            bg: 'color-mix(in srgb, #d9b45f 12%, var(--rose-surface))',
            boxShadow: 'inset 0 0 12px color-mix(in srgb, #d9b45f 12%, transparent)'
        }
    }
});

const MutedDash = styled('span', {
    base: {
        color: 'var(--rose-muted)'
    }
});

const ResultStatCell = styled('td', {
    base: {
        '&[data-dump="true"]': {
            color: 'var(--rose-muted)',
            fontFamily: MONO_FONT_FAMILY,
            fontSize: '0.68rem',
            lineHeight: 1.35,
            letterSpacing: 0
        }
    }
});

function SortableHeader(props: { label: string; mark: string; numeric?: boolean; title?: string; onClick: () => void }) {
    return (
        <th data-numeric={props.numeric} title={props.title}>
            <SortButton type="button" aria-label={`Sort by ${props.title ?? props.label}`} onClick={props.onClick}>
                {props.label}
                {props.mark}
            </SortButton>
        </th>
    );
}

function BonusSummary(props: { build: ArmorBuild; armorSets: ArmorBonusDefinitionSet[]; armorSetDisplayMode: ArmorSetDisplayMode }) {
    const bonuses = () => getArmorBonusDisplays(props.build, props.armorSets, props.armorSetDisplayMode);

    return (
        <BonusText>
            <Show when={bonuses().length > 0} fallback={<MutedDash>-</MutedDash>}>
                <For each={bonuses()}>
                    {(bonus) => (
                        <BonusChip data-op={bonus.isOp} title={bonus.title}>
                            {bonus.label}
                        </BonusChip>
                    )}
                </For>
            </Show>
        </BonusText>
    );
}

function ResultRow(props: {
    build: ArmorBuild;
    armorSets: ArmorBonusDefinitionSet[];
    armorSetDisplayMode: ArmorSetDisplayMode;
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
                    <ResultStatCell data-numeric data-dump={props.dumpStat === stat}>
                        {props.build.stats[stat]}
                    </ResultStatCell>
                )}
            </For>
            <td data-numeric>{props.build.score.totalStats}</td>
            <td data-text-cell>
                <BonusSummary build={props.build} armorSets={props.armorSets} armorSetDisplayMode={props.armorSetDisplayMode} />
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
        <ResultsTableFrame>
            <DataTable data-density="comfortable">
                <colgroup>
                    <For each={ARMOR_STATS}>{() => <col data-stat-column />}</For>
                    <col data-total-column />
                    <col data-bonus-column />
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
                                    armorSetDisplayMode={props.armorSetDisplayMode}
                                    dumpStat={props.dumpStat}
                                    expanded={props.expandedBuildKey === buildExpansionKey(build)}
                                    onToggle={() => props.onToggleBuild(build)}
                                />
                                <Show when={props.expandedBuildKey === buildExpansionKey(build)}>
                                    <ExpandedDetailRow>
                                        <ExpandedDetailCell colSpan={RESULT_COLUMN_COUNT}>
                                            <ExpandedDetailInner>{props.renderExpandedBuild(build, index())}</ExpandedDetailInner>
                                        </ExpandedDetailCell>
                                    </ExpandedDetailRow>
                                </Show>
                            </>
                        )}
                    </For>
                </tbody>
            </DataTable>
        </ResultsTableFrame>
    );
}
