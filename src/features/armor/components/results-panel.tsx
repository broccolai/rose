import type { ArmorBuild, ArmorBuildSort, ArmorStat, SolveArmorResult } from '@armor-calc';
import { styled } from '@panda/jsx';
import { Show } from 'solid-js';

import type { AvailableArmorSet } from '@/features/armor/calculator-view-model';
import { ResultsBuildDetail } from '@/features/armor/components/results-build-detail';
import { ResultsTable, type VisibleResultSortKey } from '@/features/armor/components/results-table';
import { PaneScroll } from '@/features/armor/components/scroll-primitives';
import { MONO_FONT_FAMILY } from '@/features/armor/components/ui-styles';
import { type ArmorSetDisplayMode, buildExpansionKey } from '@/features/armor/result-display';

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
        minH: 0,
        h: { lg: '100%' },
        display: 'grid',
        gridTemplateRows: { lg: 'auto minmax(0, 1fr)' },
        gap: 'var(--rose-space-md)'
    }
});

const ResultsHeader = styled('div', {
    base: {
        position: { lg: 'sticky' },
        top: { lg: 0 },
        zIndex: 3,
        display: 'grid',
        gridTemplateColumns: { base: 'minmax(0, 1fr)', lg: 'auto minmax(0, 1fr)' },
        alignItems: 'center',
        gap: 'var(--rose-space-sm) var(--rose-space-md)',
        pb: 'var(--rose-space-md)',
        borderBottom: '1px solid var(--rose-border)',
        bg: 'var(--rose-bg)'
    }
});

const ResultsBody = styled(PaneScroll, {
    base: {
        display: 'grid',
        alignContent: 'start',
        gap: 'var(--rose-space-md)',
        pt: 0
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
            <ResultsBody>
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
                                <MutedText>
                                    Try changing the exotic, lowering target stats, or clearing the armor set requirement.
                                </MutedText>
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
                                    <ResultsBuildDetail
                                        build={build}
                                        onEquipBuild={props.onEquipBuild}
                                        showTuningResults={props.showTuningResults}
                                    />
                                )}
                            />
                        </Show>
                    </Show>
                </Show>
            </ResultsBody>
        </ResultsShell>
    );
}
