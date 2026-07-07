import {
    ARMOR_SLOTS,
    ARMOR_STATS,
    type ArmorBuild,
    type ArmorBuildSort,
    type ArmorSlot,
    type ArmorStat,
    type SolveArmorResult
} from '@armor-calc';
import { styled } from '@panda/jsx';
import { debounce } from '@solid-primitives/scheduled';
import { createSignal, For, Show } from 'solid-js';

import type { AvailableArmorSet } from '@/features/armor/calculator-view-model';
import { ResultsTable, type VisibleResultSortKey } from '@/features/armor/components/results-table';
import { MONO_FONT_FAMILY } from '@/features/armor/components/ui-styles';
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
    expandedBuildKey: string | null;
    onExpandedBuildKeyChange: (key: string | null) => void;
    onEquipBuild?: (build: ArmorBuild) => Promise<void>;
    onSort: (key: VisibleResultSortKey) => void;
};

const ResultsShell = styled('div', {
    base: {
        maxW: 'none',
        mx: 'auto',
        w: '100%',
        display: 'grid',
        gap: 'var(--rose-space-md)'
    }
});

const ResultsHeader = styled('div', {
    base: {
        display: 'grid',
        gridTemplateColumns: { base: 'minmax(0, 1fr)', lg: 'auto minmax(0, 1fr)' },
        alignItems: 'center',
        gap: 'var(--rose-space-sm) var(--rose-space-md)'
    }
});

const ResultsTitle = styled('h2', {
    base: {
        m: 0,
        fontFamily: MONO_FONT_FAMILY,
        fontSize: '1.05rem',
        lineHeight: 1,
        fontWeight: 780,
        color: 'var(--rose-text)'
    }
});

const HeaderTools = styled('div', {
    base: {
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--rose-space-xs) var(--rose-space-sm)',
        flexWrap: 'wrap',
        justifyContent: { base: 'flex-start', lg: 'flex-end' },
        minW: 0
    }
});

const EmptyState = styled('div', {
    base: {
        minH: '8rem',
        display: 'grid',
        placeItems: 'center',
        border: '1px solid var(--rose-border)',
        borderRadius: 'var(--rose-radius-md)',
        bg: 'var(--rose-surface)',
        p: 'var(--rose-space-lg)',
        '& p': {
            m: 0
        }
    }
});

const TinyMuted = styled('span', {
    base: {
        color: 'var(--rose-muted)',
        fontFamily: MONO_FONT_FAMILY,
        fontSize: '0.72rem',
        lineHeight: 1.35,
        letterSpacing: 0
    }
});

const StateCard = styled('div', {
    base: {
        minH: '8rem',
        display: 'grid',
        alignContent: 'center',
        gap: 'var(--rose-space-xs)',
        border: '1px solid var(--rose-border)',
        borderRadius: 'var(--rose-radius-md)',
        bg: 'var(--rose-surface)',
        p: 'var(--rose-space-lg)',
        '& h3': {
            m: 0,
            color: 'var(--rose-text)',
            fontSize: '0.98rem',
            fontWeight: 760
        },
        '& p': {
            m: 0
        }
    }
});

const LoadingStateCard = styled('div', {
    base: {
        minH: '4.8rem',
        display: 'grid',
        alignContent: 'center',
        gap: 'var(--rose-space-xs)',
        border: '1px solid var(--rose-border)',
        borderRadius: 'var(--rose-radius-md)',
        bg: 'var(--rose-surface)',
        p: 'var(--rose-space-md)',
        '& p': {
            m: 0
        }
    }
});

const ProgressTrack = styled('div', {
    base: {
        h: '6px',
        mt: 'var(--rose-space-xs)',
        overflow: 'hidden',
        borderRadius: '999px',
        bg: 'var(--rose-surface-soft)'
    }
});

const ProgressBar = styled('div', {
    base: {
        h: '100%',
        bg: 'var(--rose-accent)'
    }
});

const DetailPanel = styled('div', {
    base: {
        bg: 'var(--rose-surface)',
        p: 0
    }
});

const DetailTableWrap = styled('div', {
    base: {
        w: '100%',
        maxW: '100%',
        overflowX: 'hidden',
        borderTop: '1px solid var(--rose-border)'
    }
});

const DetailActions = styled('div', {
    base: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: 'var(--rose-space-sm)',
        p: 'var(--rose-space-sm)',
        borderTop: '1px solid var(--rose-border)',
        bg: 'color-mix(in srgb, var(--rose-surface-soft) 36%, var(--rose-surface))',
        '@media (max-width: 560px)': {
            gridTemplateColumns: '1fr'
        }
    }
});

const DetailActionButton = styled('button', {
    base: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        w: '100%',
        minH: 'var(--rose-control-height)',
        px: 'var(--rose-control-padding-x)',
        border: '1px solid color-mix(in srgb, var(--rose-accent) 28%, var(--rose-border))',
        borderRadius: 'var(--rose-radius-md)',
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
    }
});

const DetailTable = styled('table', {
    base: {
        w: '100%',
        minW: 0,
        tableLayout: 'fixed',
        borderCollapse: 'collapse',
        fontFamily: MONO_FONT_FAMILY,
        fontSize: '0.74rem',
        '& th': {
            p: 'var(--rose-space-xs) var(--rose-space-sm)',
            color: 'var(--rose-muted)',
            bg: '#0a0a0c',
            borderBottom: '1px solid var(--rose-border)',
            textAlign: 'left',
            fontWeight: 720,
            lineHeight: 1.15
        },
        '& td': {
            p: 'var(--rose-space-xs) var(--rose-space-sm)',
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
    }
});

const PieceName = styled('span', {
    base: {
        minW: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontWeight: 720
    }
});

const MutedText = styled('p', {
    base: {
        color: 'var(--rose-muted)',
        lineHeight: 1.45,
        fontFamily: MONO_FONT_FAMILY,
        fontSize: '0.74rem',
        letterSpacing: 0,
        textTransform: 'none'
    }
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

function BuildDetail(props: { build: ArmorBuild; onEquipBuild?: (build: ArmorBuild) => Promise<void>; showTuningResults: boolean }) {
    const [copyState, setCopyState] = createSignal<'idle' | 'copied' | 'failed'>('idle');
    const [equipState, setEquipState] = createSignal<'idle' | 'equipping' | 'done' | 'failed'>('idle');
    const resetCopiedState = debounce(() => setCopyState('idle'), 1400);
    const resetCopyFailedState = debounce(() => setCopyState('idle'), 1800);
    const resetEquippedState = debounce(() => setEquipState('idle'), 1600);
    const resetEquipFailedState = debounce(() => setEquipState('idle'), 2200);

    function clearPendingButtonResets() {
        resetCopiedState.clear();
        resetCopyFailedState.clear();
        resetEquippedState.clear();
        resetEquipFailedState.clear();
    }

    async function copyDimQuery() {
        clearPendingButtonResets();
        try {
            await copyTextToClipboard(formatDimArmorQuery(props.build));
            setCopyState('copied');
            resetCopiedState();
        } catch {
            setCopyState('failed');
            resetCopyFailedState();
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

    async function equipBuild() {
        if (!props.onEquipBuild || equipState() === 'equipping') {
            return;
        }

        clearPendingButtonResets();
        try {
            setEquipState('equipping');
            await props.onEquipBuild(props.build);
            setEquipState('done');
            resetEquippedState();
        } catch {
            setEquipState('failed');
            resetEquipFailedState();
        }
    }

    const equipLabel = () => {
        if (equipState() === 'equipping') {
            return 'Equipping...';
        }

        if (equipState() === 'done') {
            return 'Equipped';
        }

        if (equipState() === 'failed') {
            return 'Equip failed';
        }

        return 'Equip Items';
    };

    return (
        <DetailPanel>
            <DetailTableWrap>
                <DetailTable>
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
                                            <PieceName title={piece().item.name}>{piece().item.name}</PieceName>
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
                </DetailTable>
                <DetailActions>
                    <DetailActionButton type="button" onClick={copyDimQuery}>
                        {copyLabel()}
                    </DetailActionButton>
                    <DetailActionButton type="button" disabled={!props.onEquipBuild || equipState() === 'equipping'} onClick={equipBuild}>
                        {equipLabel()}
                    </DetailActionButton>
                </DetailActions>
            </DetailTableWrap>
        </DetailPanel>
    );
}

export function ResultsPanel(props: ResultsPanelProps) {
    function toggleExpandedBuild(build: ArmorBuild) {
        const key = buildExpansionKey(build);
        props.onExpandedBuildKeyChange(props.expandedBuildKey === key ? null : key);
    }

    function resultCountLabel() {
        const result = props.result;
        if (!result?.ok) {
            return '';
        }

        return `${result.validBuildCount} builds found · ${result.returnedBuildCount} retained after pruning`;
    }

    return (
        <ResultsShell>
            <ResultsHeader>
                <ResultsTitle>Results</ResultsTitle>
                <HeaderTools>
                    <Show when={props.result?.ok}>
                        <TinyMuted>{resultCountLabel()}</TinyMuted>
                    </Show>
                </HeaderTools>
            </ResultsHeader>
            <Show when={props.loading && !props.result}>
                <LoadingStateCard>
                    <MutedText>{props.progress.label || 'Working'}</MutedText>
                    <Show when={props.progress.active}>
                        <ProgressTrack>
                            <ProgressBar style={{ width: `${props.progress.percent}%` }} />
                        </ProgressTrack>
                    </Show>
                </LoadingStateCard>
            </Show>
            <Show
                when={props.result}
                fallback={
                    <Show when={!props.loading}>
                        <EmptyState>
                            <MutedText>Awaiting solve.</MutedText>
                        </EmptyState>
                    </Show>
                }
            >
                <Show
                    when={!props.resultFailure}
                    fallback={
                        <StateCard>
                            <h3>No builds matched these requirements.</h3>
                            <MutedText>{props.resultFailure}</MutedText>
                            <MutedText>Try changing the exotic, lowering target stats, or clearing the armor set requirement.</MutedText>
                        </StateCard>
                    }
                >
                    <Show
                        when={props.builds.length > 0}
                        fallback={
                            <StateCard>
                                <h3>No matching armor for this character.</h3>
                                <MutedText>Try clearing the exotic or armor set requirements.</MutedText>
                            </StateCard>
                        }
                    >
                        <ResultsTable
                            builds={props.builds}
                            armorSets={props.armorSets}
                            armorSetDisplayMode={props.armorSetDisplayMode}
                            dumpStat={props.dumpStat}
                            expandedBuildKey={props.expandedBuildKey}
                            sort={props.sort}
                            visibleLimit={props.visibleLimit}
                            onSort={props.onSort}
                            onToggleBuild={toggleExpandedBuild}
                            renderExpandedBuild={(build) => (
                                <BuildDetail build={build} onEquipBuild={props.onEquipBuild} showTuningResults={props.showTuningResults} />
                            )}
                        />
                    </Show>
                </Show>
            </Show>
        </ResultsShell>
    );
}
