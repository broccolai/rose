import type { ArmorBuild } from '@armor-domain';
import { styled } from '@panda/jsx';
import { createMemo, Show } from 'solid-js';

import { useArmorCalculator } from '@/features/armor/armor-calculator-context';
import { sortArmorBuildsForDisplay } from '@/features/armor/calculator-view-model';
import { ResultsBuildDetail } from '@/features/armor/components/results-build-detail';
import { ResultsTable } from '@/features/armor/components/results-table';
import { PaneScroll } from '@/features/armor/components/scroll-primitives';
import { MONO_FONT_FAMILY } from '@/features/armor/components/ui-styles';
import { buildExpansionKey } from '@/features/armor/result-display';

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
        fontWeight: 700,
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

const ResultsTabs = styled('div', {
    base: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: '2px',
        p: '2px',
        border: '1px solid var(--rose-border)',
        borderRadius: 'var(--rose-radius-sm)',
        bg: 'var(--rose-surface-soft)'
    }
});

const ResultsTab = styled('button', {
    base: {
        minH: '1.8rem',
        px: 'var(--rose-space-sm)',
        border: 0,
        borderRadius: 'var(--rose-radius-xs)',
        bg: 'transparent',
        color: 'var(--rose-muted)',
        cursor: 'pointer',
        fontFamily: MONO_FONT_FAMILY,
        fontSize: '0.7rem',
        fontWeight: 700,
        _hover: {
            color: 'var(--rose-text)'
        },
        '&[data-selected="true"]': {
            bg: 'var(--rose-surface-raised)',
            color: 'var(--rose-text)'
        }
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
            fontWeight: 700
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

export function ResultsPanel() {
    const calculator = useArmorCalculator();
    const results = calculator.results;
    const actions = calculator.actions;
    const historyBuilds = createMemo(() =>
        sortArmorBuildsForDisplay(
            results.savedBuilds().map((entry) => entry.build),
            results.sort()
        )
    );

    function toggleExpandedBuild(build: ArmorBuild) {
        const key = buildExpansionKey(build);
        actions.setExpandedBuildKey(results.expandedBuildKey() === key ? null : key);
    }

    function resultCountLabel() {
        if (results.view() === 'history') {
            return `${results.savedBuilds().length} saved`;
        }

        const result = results.result();
        if (!result?.ok) {
            return '';
        }

        if (results.loading()) {
            return `${result.returnedBuildCount} builds ready - Calculating more...`;
        }

        return `${result.validBuildCount} builds found`;
    }

    return (
        <ResultsShell>
            <ResultsHeader>
                <ResultsTitle>Results</ResultsTitle>
                <HeaderTools>
                    <Show when={results.view() === 'history' || results.result()?.ok}>
                        <TinyMuted>{resultCountLabel()}</TinyMuted>
                    </Show>
                    <ResultsTabs role="tablist" aria-label="Result views">
                        <ResultsTab
                            type="button"
                            role="tab"
                            aria-selected={results.view() === 'results'}
                            data-selected={results.view() === 'results'}
                            onClick={() => actions.setResultsView('results')}
                        >
                            Results
                        </ResultsTab>
                        <ResultsTab
                            type="button"
                            role="tab"
                            aria-selected={results.view() === 'history'}
                            data-selected={results.view() === 'history'}
                            onClick={() => actions.setResultsView('history')}
                        >
                            History
                        </ResultsTab>
                    </ResultsTabs>
                </HeaderTools>
            </ResultsHeader>
            <ResultsBody>
                <Show when={results.view() === 'history'}>
                    <Show
                        when={historyBuilds().length > 0}
                        fallback={
                            <EmptyState>
                                <MutedText>Saved builds will appear here.</MutedText>
                            </EmptyState>
                        }
                    >
                        <ResultsTable
                            builds={historyBuilds()}
                            armorSets={results.armorSets()}
                            armorSetDisplayMode={results.armorSetDisplayMode()}
                            dumpStat={results.dumpStat()}
                            expandedBuildKey={results.expandedBuildKey()}
                            sort={results.sort()}
                            visibleLimit={50}
                            onSort={actions.sortResults}
                            onToggleBuild={toggleExpandedBuild}
                            renderExpandedBuild={(build) => (
                                <ResultsBuildDetail
                                    build={build}
                                    onEquipBuild={actions.equipBuild}
                                    onToggleSavedBuild={actions.toggleSavedBuild}
                                    saved={results.isBuildSaved(build)}
                                    showTuningResults={results.showTuningResults()}
                                />
                            )}
                        />
                    </Show>
                </Show>
                <Show when={results.view() === 'results'}>
                    <Show when={results.loading() && !results.result()}>
                        <LoadingStateCard>
                            <MutedText>{results.progress().label || 'Working'}</MutedText>
                            <Show when={results.progress().active}>
                                <ProgressTrack>
                                    <ProgressBar style={{ width: `${results.progress().percent}%` }} />
                                </ProgressTrack>
                            </Show>
                        </LoadingStateCard>
                    </Show>
                    <Show
                        when={results.result()}
                        fallback={
                            <Show when={!results.loading()}>
                                <EmptyState>
                                    <MutedText>Awaiting solve.</MutedText>
                                </EmptyState>
                            </Show>
                        }
                    >
                        <Show
                            when={!results.resultFailure()}
                            fallback={
                                <StateCard>
                                    <h3>No builds matched these requirements.</h3>
                                    <MutedText>{results.resultFailure()}</MutedText>
                                    <MutedText>
                                        Try changing the exotic, lowering target stats, or clearing the armor set requirement.
                                    </MutedText>
                                </StateCard>
                            }
                        >
                            <Show
                                when={results.builds().length > 0}
                                fallback={
                                    <StateCard>
                                        <h3>No matching armor for this character.</h3>
                                        <MutedText>Try clearing the exotic or armor set requirements.</MutedText>
                                    </StateCard>
                                }
                            >
                                <ResultsTable
                                    builds={results.builds()}
                                    armorSets={results.armorSets()}
                                    armorSetDisplayMode={results.armorSetDisplayMode()}
                                    dumpStat={results.dumpStat()}
                                    expandedBuildKey={results.expandedBuildKey()}
                                    sort={results.sort()}
                                    visibleLimit={results.visibleLimit()}
                                    onSort={actions.sortResults}
                                    onToggleBuild={toggleExpandedBuild}
                                    renderExpandedBuild={(build) => (
                                        <ResultsBuildDetail
                                            build={build}
                                            onEquipBuild={actions.equipBuild}
                                            onToggleSavedBuild={actions.toggleSavedBuild}
                                            saved={results.isBuildSaved(build)}
                                            showTuningResults={results.showTuningResults()}
                                        />
                                    )}
                                />
                            </Show>
                        </Show>
                    </Show>
                </Show>
            </ResultsBody>
        </ResultsShell>
    );
}
