import { styled } from '@panda/jsx';
import AlertTriangle from 'lucide-solid/icons/alert-triangle';
import ArrowDown from 'lucide-solid/icons/arrow-down';
import ArrowUp from 'lucide-solid/icons/arrow-up';
import LoaderCircle from 'lucide-solid/icons/loader-circle';
import X from 'lucide-solid/icons/x';
import { For, Show } from 'solid-js';

import { weaponsStatDamageScalar } from '@/features/weapons/calculations';
import { IconButton, NumberInput, SectionHeading } from '@/features/weapons/components/primitives';
import type { SavedWeaponRoll, WeaponCatalog, WeaponEngineCalculation, WeaponMode } from '@/features/weapons/types';

type AnalysisPanelProps = {
    catalog: WeaponCatalog;
    calculation: WeaponEngineCalculation | null;
    calculationStatus: 'idle' | 'loading' | 'ready' | 'error';
    mode: WeaponMode;
    targetHealth: number;
    overshield: number;
    weaponsStat: number;
    rolls: SavedWeaponRoll[];
    compareError: string;
    onTargetHealthChange: (value: number) => void;
    onOvershieldChange: (value: number) => void;
    onWeaponsStatChange: (value: number) => void;
    onLoadRoll: (roll: SavedWeaponRoll) => void;
    onRemoveRoll: (id: string) => void;
    onMoveRoll: (index: number, direction: -1 | 1) => void;
};

const Panel = styled('div', {
    base: {
        display: 'grid',
        alignContent: 'start',
        minW: 0
    }
});

const Section = styled('section', {
    base: {
        display: 'grid',
        gap: '0.85rem',
        p: '1rem',
        borderBottom: '1px solid var(--rose-border)',
        _last: { borderBottom: 0 }
    }
});

const HeadingRow = styled('div', {
    base: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '0.75rem'
    }
});

const PvpLabel = styled('span', {
    base: {
        color: 'var(--rose-muted)',
        fontSize: '0.62rem',
        fontWeight: 750,
        textTransform: 'uppercase'
    }
});

const TtkHero = styled('div', {
    base: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
        gap: '1px',
        border: '1px solid var(--rose-border)',
        bg: 'var(--rose-border)'
    }
});

const TtkResult = styled('div', {
    base: {
        display: 'grid',
        gap: '0.35rem',
        minW: 0,
        p: '0.8rem',
        bg: 'var(--rose-surface-soft)'
    }
});

const ResultLabel = styled('span', {
    base: {
        color: 'var(--rose-muted)',
        fontSize: '0.61rem',
        fontWeight: 750,
        textTransform: 'uppercase'
    }
});

const ResultTime = styled('strong', {
    base: {
        color: 'var(--rose-text)',
        fontSize: '1.65rem',
        fontVariantNumeric: 'tabular-nums',
        fontWeight: 780,
        letterSpacing: 0,
        lineHeight: 1
    }
});

const ResultShots = styled('span', {
    base: {
        overflow: 'hidden',
        color: 'var(--rose-muted-strong)',
        fontSize: '0.66rem',
        lineHeight: 1.2,
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
    }
});

const TargetControls = styled('div', {
    base: {
        display: 'grid',
        gap: '0.7rem'
    }
});

const TargetRow = styled('div', {
    base: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 4.75rem',
        alignItems: 'center',
        gap: '0.45rem 0.6rem',
        minW: 0,
        '@media (min-width: 32rem)': {
            gridTemplateColumns: 'minmax(6.5rem, 1fr) minmax(7rem, 1.3fr) auto',
            gap: '0.6rem'
        }
    }
});

const TargetLabel = styled('label', {
    base: {
        display: 'grid',
        gridColumn: '1 / -1',
        gap: '0.12rem',
        minW: 0,
        color: 'var(--rose-muted-strong)',
        fontSize: '0.68rem',
        fontWeight: 700,
        lineHeight: 1.15,
        '& small': {
            color: 'var(--rose-muted)',
            fontSize: '0.57rem',
            fontWeight: 600
        },
        '@media (min-width: 32rem)': { gridColumn: 'auto' }
    }
});

const RangeInput = styled('input', {
    base: {
        appearance: 'none',
        w: '100%',
        h: '0.48rem',
        overflow: 'hidden',
        border: '1px solid var(--rose-border)',
        borderRadius: '999px',
        bg: 'var(--rose-slider-empty-a)',
        outline: 'none',
        '&::-webkit-slider-thumb': {
            appearance: 'none',
            w: '0.72rem',
            h: '0.72rem',
            border: '1px solid var(--rose-bg)',
            borderRadius: '50%',
            bg: 'var(--rose-accent)',
            boxShadow: '-25rem 0 0 24.7rem var(--rose-accent)'
        },
        '&::-moz-range-thumb': {
            w: '0.72rem',
            h: '0.72rem',
            border: '1px solid var(--rose-bg)',
            borderRadius: '50%',
            bg: 'var(--rose-accent)'
        },
        '&::-moz-range-progress': {
            h: '100%',
            borderRadius: '999px',
            bg: 'var(--rose-accent)'
        },
        _focusVisible: {
            outline: '2px solid color-mix(in srgb, var(--rose-accent) 35%, transparent)',
            outlineOffset: '3px'
        }
    }
});

const DamageGrid = styled('dl', {
    base: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: '0.55rem',
        m: 0,
        '& > div': {
            display: 'grid',
            gap: '0.15rem',
            py: '0.4rem',
            borderTop: '1px solid var(--rose-border)'
        },
        '& dt': { color: 'var(--rose-muted)', fontSize: '0.6rem', textTransform: 'uppercase' },
        '& dd': {
            m: 0,
            color: 'var(--rose-text)',
            fontSize: '0.86rem',
            fontVariantNumeric: 'tabular-nums',
            fontWeight: 750
        }
    }
});

const CalculationState = styled('div', {
    base: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.45rem',
        minH: '5.8rem',
        border: '1px solid var(--rose-border)',
        bg: 'var(--rose-surface-soft)',
        color: 'var(--rose-muted)',
        fontSize: '0.7rem',
        textAlign: 'center',
        '& svg': { w: '0.9rem', h: '0.9rem' },
        '&[data-loading="true"] svg': { animation: 'rose-spin 900ms linear infinite' }
    }
});

const Warning = styled('div', {
    base: {
        display: 'grid',
        gridTemplateColumns: '0.9rem minmax(0, 1fr)',
        alignItems: 'start',
        gap: '0.45rem',
        p: '0.6rem',
        borderLeft: '2px solid var(--rose-formula-partial)',
        bg: 'color-mix(in srgb, var(--rose-formula-partial) 8%, var(--rose-surface-soft))',
        color: 'var(--rose-muted-strong)',
        fontSize: '0.64rem',
        lineHeight: 1.35,
        '& svg': { w: '0.85rem', h: '0.85rem', color: 'var(--rose-formula-partial)' }
    }
});

const Provenance = styled('a', {
    base: {
        justifySelf: 'start',
        color: 'var(--rose-muted)',
        fontSize: '0.59rem',
        fontWeight: 650,
        lineHeight: 1.2,
        textDecoration: 'none',
        _hover: { color: 'var(--rose-accent)' }
    }
});

const CompareList = styled('div', {
    base: {
        display: 'grid',
        borderTop: '1px solid var(--rose-border)'
    }
});

const CompareContent = styled('div', {
    base: { display: 'grid', gap: '0.85rem', minW: 0 }
});

const CompareRow = styled('div', {
    base: {
        display: 'grid',
        gridTemplateColumns: '2.5rem minmax(0, 1fr) auto',
        gap: '0.55rem',
        alignItems: 'center',
        minW: 0,
        py: '0.6rem',
        borderBottom: '1px solid var(--rose-border)'
    }
});

const CompareIcon = styled('img', {
    base: {
        display: 'block',
        w: '2.5rem',
        h: '2.5rem',
        borderRadius: 'var(--rose-radius-xs)',
        objectFit: 'cover'
    }
});

const CompareMain = styled('button', {
    base: {
        display: 'grid',
        gap: '0.2rem',
        minW: 0,
        p: 0,
        border: 0,
        bg: 'transparent',
        color: 'var(--rose-text)',
        textAlign: 'left',
        outline: 'none',
        _focusVisible: { outline: '2px solid color-mix(in srgb, var(--rose-accent) 36%, transparent)', outlineOffset: '2px' }
    }
});

const CompareName = styled('span', {
    base: {
        overflow: 'hidden',
        fontSize: '0.72rem',
        fontWeight: 750,
        lineHeight: 1.1,
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
    }
});

const CompareMeta = styled('span', {
    base: {
        overflow: 'hidden',
        color: 'var(--rose-muted)',
        fontSize: '0.59rem',
        lineHeight: 1.25,
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
    }
});

const CompareMetrics = styled('span', {
    base: {
        display: 'flex',
        gap: '0.5rem',
        color: 'var(--rose-muted-strong)',
        fontSize: '0.61rem',
        fontVariantNumeric: 'tabular-nums',
        fontWeight: 700
    }
});

const RowActions = styled('div', {
    base: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1.75rem)',
        gap: '0.2rem',
        '& button': { w: '1.75rem', h: '1.75rem' },
        '& button:last-child': { gridColumn: '1 / -1', justifySelf: 'end' }
    }
});

const EmptyCompare = styled('div', {
    base: {
        display: 'grid',
        placeItems: 'center',
        minH: '5rem',
        borderTop: '1px solid var(--rose-border)',
        color: 'var(--rose-muted)',
        fontSize: '0.68rem'
    }
});

const CompareMatrix = styled('div', {
    base: {
        maxW: '100%',
        overflowX: 'auto',
        border: '1px solid var(--rose-border)',
        overscrollBehaviorInline: 'contain',
        '& table': {
            minW: '100%',
            borderCollapse: 'separate',
            borderSpacing: 0,
            color: 'var(--rose-text)',
            fontSize: '0.63rem',
            fontVariantNumeric: 'tabular-nums',
            textAlign: 'right'
        },
        '& caption': {
            position: 'absolute',
            w: '1px',
            h: '1px',
            overflow: 'hidden',
            clip: 'rect(0 0 0 0)',
            whiteSpace: 'nowrap'
        },
        '& th, & td': {
            minW: '6.8rem',
            p: '0.48rem 0.55rem',
            borderRight: '1px solid var(--rose-border)',
            borderBottom: '1px solid var(--rose-border)',
            bg: 'var(--rose-surface-soft)',
            whiteSpace: 'nowrap'
        },
        '& thead th': {
            overflow: 'hidden',
            maxW: '7.5rem',
            bg: 'var(--rose-table-header)',
            fontWeight: 800,
            textOverflow: 'ellipsis'
        },
        '& tr:last-child > *': { borderBottom: 0 },
        '& tr > *:last-child': { borderRight: 0 },
        '& th:first-child': {
            position: 'sticky',
            left: 0,
            zIndex: 1,
            minW: '6.5rem',
            color: 'var(--rose-muted-strong)',
            textAlign: 'left'
        },
        '& thead th:first-child': { zIndex: 2 }
    }
});

const MetricValue = styled('span', {
    base: {
        display: 'inline-flex',
        alignItems: 'baseline',
        justifyContent: 'flex-end',
        gap: '0.28rem',
        fontWeight: 750,
        '& small': { color: 'var(--rose-muted)', fontSize: '0.54rem', fontWeight: 700 },
        '&[data-direction="better"] small': { color: 'var(--rose-formula-full)' },
        '&[data-direction="worse"] small': { color: 'var(--rose-warning)' }
    }
});

type CompareMetric = {
    label: string;
    unit: string;
    precision: number;
    lowerIsBetter?: boolean;
    value: (roll: SavedWeaponRoll) => number | null;
};

const COMPARE_METRICS: CompareMetric[] = [
    { label: 'Optimal TTK', unit: 's', precision: 2, lowerIsBetter: true, value: (roll) => roll.optimalTtk },
    { label: 'ADS range', unit: 'm', precision: 1, value: (roll) => roll.range },
    { label: 'Range', unit: '', precision: 0, value: (roll) => roll.stats['Range'] ?? null },
    { label: 'Stability', unit: '', precision: 0, value: (roll) => roll.stats['Stability'] ?? null },
    { label: 'Handling', unit: '', precision: 0, value: (roll) => roll.stats['Handling'] ?? null },
    { label: 'Reload', unit: '', precision: 0, value: (roll) => roll.stats['Reload Speed'] ?? null },
    { label: 'Aim assist', unit: '', precision: 0, value: (roll) => roll.stats['Aim Assistance'] ?? null }
];

function formatTime(value: number | undefined) {
    return Number.isFinite(value) ? `${Number(value).toFixed(2)}s` : '—';
}

function formatShots(headshots: number | undefined, bodyshots: number | undefined) {
    if (!Number.isFinite(headshots) || !Number.isFinite(bodyshots)) return 'No shot data';
    const parts = [];
    if (headshots) parts.push(`${headshots} crit`);
    if (bodyshots) parts.push(`${bodyshots} body`);
    return parts.join(' + ') || '1 shot';
}

function scenarioSummary(roll: SavedWeaponRoll) {
    const totalHealth = roll.scenario.targetHealth + roll.scenario.overshield;
    return roll.scenario.mode === 'pvp' ? `${totalHealth} HP · W${roll.scenario.weaponsStat}` : 'PvE profile';
}

function ComparisonValue(props: {
    metric: CompareMetric;
    roll: SavedWeaponRoll;
    baseline: SavedWeaponRoll | undefined;
    baselineCell: boolean;
}) {
    const value = () => props.metric.value(props.roll);
    const baselineValue = () => (props.baseline ? props.metric.value(props.baseline) : null);
    const delta = () => {
        const current = value();
        const baseline = baselineValue();
        return current === null || baseline === null ? null : current - baseline;
    };
    const direction = () => {
        const difference = delta();
        if (props.baselineCell || difference === null || Math.abs(difference) < 0.0001) return 'same';
        const better = props.metric.lowerIsBetter ? difference < 0 : difference > 0;
        return better ? 'better' : 'worse';
    };
    return (
        <MetricValue data-direction={direction()}>
            <span>{value() === null ? '—' : `${value()?.toFixed(props.metric.precision)}${props.metric.unit}`}</span>
            <Show when={!props.baselineCell && delta() !== null && Math.abs(delta() ?? 0) >= 0.0001}>
                <small>
                    {(delta() ?? 0) > 0 ? '+' : ''}
                    {delta()?.toFixed(props.metric.precision)}
                </small>
            </Show>
        </MetricValue>
    );
}

export function AnalysisPanel(props: AnalysisPanelProps) {
    const unsupportedNames = () =>
        props.calculation?.unsupportedTraitHashes.map((hash) => props.catalog.plugs[String(hash)]?.name ?? String(hash)).join(', ') ?? '';
    const partiallyModeledNames = () =>
        props.calculation?.partiallyModeledTraitHashes.map((hash) => props.catalog.plugs[String(hash)]?.name ?? String(hash)).join(', ') ??
        '';
    return (
        <Panel>
            <Section>
                <HeadingRow>
                    <SectionHeading>{props.mode === 'pvp' ? 'TTK' : 'Damage'}</SectionHeading>
                    <PvpLabel>{props.mode === 'pvp' ? `PvP · ${props.targetHealth + props.overshield} HP` : 'PvE profile'}</PvpLabel>
                </HeadingRow>
                <Show when={props.mode === 'pvp'}>
                    <Show
                        when={props.calculationStatus === 'ready' ? props.calculation?.ttk : null}
                        fallback={
                            <CalculationState
                                data-loading={props.calculationStatus === 'loading'}
                                role={props.calculationStatus === 'error' ? 'alert' : 'status'}
                                aria-live="polite"
                            >
                                {props.calculationStatus === 'loading' ? (
                                    <LoaderCircle aria-hidden="true" />
                                ) : (
                                    <AlertTriangle aria-hidden="true" />
                                )}
                                {props.calculationStatus === 'loading'
                                    ? 'Calculating'
                                    : props.calculationStatus === 'error'
                                      ? 'Calculation failed'
                                      : 'No verified TTK formula'}
                            </CalculationState>
                        }
                    >
                        {(ttk) => (
                            <TtkHero>
                                <TtkResult>
                                    <ResultLabel>Optimal</ResultLabel>
                                    <ResultTime>{formatTime(ttk().optimalTtk?.timeTaken)}</ResultTime>
                                    <ResultShots>{formatShots(ttk().optimalTtk?.headshots, ttk().optimalTtk?.bodyshots)}</ResultShots>
                                </TtkResult>
                                <TtkResult>
                                    <ResultLabel>Body</ResultLabel>
                                    <ResultTime>{formatTime(ttk().bodyTtk?.timeTaken)}</ResultTime>
                                    <ResultShots>{formatShots(0, ttk().bodyTtk?.bodyshots)}</ResultShots>
                                </TtkResult>
                            </TtkHero>
                        )}
                    </Show>

                    <TargetControls>
                        <TargetRow>
                            <TargetLabel for="weapon-target-health">Target health</TargetLabel>
                            <RangeInput
                                id="weapon-target-health"
                                type="range"
                                min="1"
                                max="500"
                                step="1"
                                value={props.targetHealth}
                                aria-label="Target health slider"
                                onInput={(event) => props.onTargetHealthChange(Number(event.currentTarget.value))}
                            />
                            <NumberInput
                                type="number"
                                min="1"
                                max="500"
                                value={props.targetHealth}
                                aria-label="Target health value"
                                onChange={(event) => props.onTargetHealthChange(Number(event.currentTarget.value))}
                            />
                        </TargetRow>
                        <TargetRow>
                            <TargetLabel for="weapon-overshield">Overshield</TargetLabel>
                            <RangeInput
                                id="weapon-overshield"
                                type="range"
                                min="0"
                                max="100"
                                step="1"
                                value={props.overshield}
                                aria-label="Overshield slider"
                                onInput={(event) => props.onOvershieldChange(Number(event.currentTarget.value))}
                            />
                            <NumberInput
                                type="number"
                                min="0"
                                max="100"
                                value={props.overshield}
                                aria-label="Overshield value"
                                onChange={(event) => props.onOvershieldChange(Number(event.currentTarget.value))}
                            />
                        </TargetRow>
                        <TargetRow>
                            <TargetLabel for="weapon-weapons-stat">
                                Weapons stat
                                <small>+{((weaponsStatDamageScalar(props.weaponsStat) - 1) * 100).toFixed(1)}% PvP</small>
                            </TargetLabel>
                            <RangeInput
                                id="weapon-weapons-stat"
                                type="range"
                                min="100"
                                max="200"
                                step="1"
                                value={props.weaponsStat}
                                aria-label="Weapons stat slider"
                                onInput={(event) => props.onWeaponsStatChange(Number(event.currentTarget.value))}
                            />
                            <NumberInput
                                type="number"
                                min="100"
                                max="200"
                                value={props.weaponsStat}
                                aria-label="Weapons stat value"
                                onChange={(event) => props.onWeaponsStatChange(Number(event.currentTarget.value))}
                            />
                        </TargetRow>
                    </TargetControls>
                </Show>

                <DamageGrid>
                    <div>
                        <dt>Crit damage</dt>
                        <dd>{props.calculation?.firing ? props.calculation.firing.critDamage.toFixed(2) : '—'}</dd>
                    </div>
                    <div>
                        <dt>Body damage</dt>
                        <dd>{props.calculation?.firing ? props.calculation.firing.bodyDamage.toFixed(2) : '—'}</dd>
                    </div>
                </DamageGrid>

                <Show when={props.calculation?.coverage === 'partial'}>
                    <Warning role="status">
                        <AlertTriangle aria-hidden="true" />
                        <span>
                            {unsupportedNames() ? `Unconfirmed perk formulas: ${unsupportedNames()}. ` : ''}
                            {partiallyModeledNames()
                                ? `Partially modeled: ${partiallyModeledNames()}. See the effect note for limitations.`
                                : ''}
                        </span>
                    </Warning>
                </Show>
                <Provenance
                    href="https://github.com/d2foundry/oracle_engine"
                    target="_blank"
                    rel="noreferrer"
                    title="D2Foundry Oracle Engine source"
                >
                    Oracle {props.calculation?.engineVersion ?? '8.2.6'} · 2026-05-19
                </Provenance>
            </Section>

            <Section>
                <HeadingRow>
                    <SectionHeading>Compare</SectionHeading>
                    <PvpLabel>{props.rolls.length}/6</PvpLabel>
                </HeadingRow>
                <Show when={props.compareError}>
                    <Warning role="alert">
                        <AlertTriangle aria-hidden="true" />
                        <span>{props.compareError}</span>
                    </Warning>
                </Show>
                <Show when={props.rolls.length > 0} fallback={<EmptyCompare>No pinned rolls</EmptyCompare>}>
                    <CompareContent>
                        <CompareList>
                            <For each={props.rolls}>
                                {(roll, index) => (
                                    <CompareRow>
                                        <CompareIcon src={`https://www.bungie.net${roll.icon}`} alt="" loading="lazy" />
                                        <CompareMain
                                            type="button"
                                            aria-label={`Load ${roll.weaponName} comparison roll`}
                                            title="Load roll and scenario"
                                            onClick={() => props.onLoadRoll(roll)}
                                        >
                                            <CompareName>{roll.weaponName}</CompareName>
                                            <CompareMeta title={roll.perkNames.join(' · ') || roll.subtitle}>
                                                {roll.perkNames.join(' · ') || roll.subtitle}
                                            </CompareMeta>
                                            <CompareMetrics>
                                                <span>{scenarioSummary(roll)}</span>
                                                <span>{roll.optimalTtk === null ? 'TTK —' : `${roll.optimalTtk.toFixed(2)}s`}</span>
                                                <span>{roll.range === null ? 'Range —' : `${roll.range.toFixed(1)}m`}</span>
                                            </CompareMetrics>
                                        </CompareMain>
                                        <RowActions>
                                            <IconButton
                                                type="button"
                                                aria-label={`Move ${roll.weaponName} roll up`}
                                                title="Move up"
                                                disabled={index() === 0}
                                                onClick={() => props.onMoveRoll(index(), -1)}
                                            >
                                                <ArrowUp aria-hidden="true" />
                                            </IconButton>
                                            <IconButton
                                                type="button"
                                                aria-label={`Move ${roll.weaponName} roll down`}
                                                title="Move down"
                                                disabled={index() === props.rolls.length - 1}
                                                onClick={() => props.onMoveRoll(index(), 1)}
                                            >
                                                <ArrowDown aria-hidden="true" />
                                            </IconButton>
                                            <IconButton
                                                type="button"
                                                aria-label={`Remove ${roll.weaponName} roll`}
                                                title="Remove"
                                                onClick={() => props.onRemoveRoll(roll.id)}
                                            >
                                                <X aria-hidden="true" />
                                            </IconButton>
                                        </RowActions>
                                    </CompareRow>
                                )}
                            </For>
                        </CompareList>
                        <CompareMatrix>
                            <table>
                                <caption>Pinned roll metric comparison. Deltas use the first roll as the baseline.</caption>
                                <thead>
                                    <tr>
                                        <th scope="col">Metric</th>
                                        <For each={props.rolls}>
                                            {(roll) => (
                                                <th scope="col" title={roll.weaponName}>
                                                    {roll.weaponName}
                                                </th>
                                            )}
                                        </For>
                                    </tr>
                                </thead>
                                <tbody>
                                    <For each={COMPARE_METRICS}>
                                        {(metric) => (
                                            <tr>
                                                <th scope="row">{metric.label}</th>
                                                <For each={props.rolls}>
                                                    {(roll, index) => (
                                                        <td>
                                                            <ComparisonValue
                                                                metric={metric}
                                                                roll={roll}
                                                                baseline={props.rolls[0]}
                                                                baselineCell={index() === 0}
                                                            />
                                                        </td>
                                                    )}
                                                </For>
                                            </tr>
                                        )}
                                    </For>
                                </tbody>
                            </table>
                        </CompareMatrix>
                    </CompareContent>
                </Show>
            </Section>
        </Panel>
    );
}
