import { ARMOR_SLOTS, ARMOR_STATS, type ArmorPlan, type ArmorSlot, type ArmorStat } from '@armor-domain';
import { styled } from '@panda/jsx';
import { For, Show } from 'solid-js';

import { DataTable, DataTableFrame } from '@/features/armor/components/data-table';
import { MONO_FONT_FAMILY } from '@/features/armor/components/ui-styles';
import { COMPACT_STAT_LABELS, SLOT_LABELS, STAT_LABELS } from '@/features/armor/display-metadata';
import { formatStatModName, formatTuningName } from '@/features/armor/model/adjustment-display';
import { armorPlanExpansionKey, type PlanningSlotRequirement } from '@/features/armor/model/armor-planning';

interface PlanningResultsProps {
    plans: ArmorPlan[];
    slotRequirements: Record<ArmorSlot, PlanningSlotRequirement>;
    dumpStat: ArmorStat | '';
    expandedPlanKey: string | null;
    onTogglePlan: (plan: ArmorPlan) => void;
}

const PlanningTableFrame = styled(DataTableFrame, {
    base: {
        w: '100%',
        maxW: '100%'
    }
});

const PlanningDetailTable = styled(DataTable, {
    base: {
        '@media (max-width: 47.99rem)': {
            display: 'block',
            w: '100%',
            '& thead': {
                display: 'none'
            },
            '& tbody': {
                display: 'grid',
                w: '100%'
            },
            '& tbody tr': {
                display: 'grid',
                gridTemplateColumns: '4.6rem minmax(0, 1fr)',
                w: '100%',
                minW: 0,
                p: 'var(--rose-space-xs) 0',
                borderBottom: '1px solid var(--rose-border)'
            },
            '& tbody tr:last-child': {
                borderBottom: 0
            },
            '& tbody td': {
                minW: 0,
                p: '0.18rem var(--rose-space-sm)',
                borderBottom: 0,
                whiteSpace: 'normal'
            },
            '& tbody td[data-slot]': {
                gridColumn: 1,
                gridRow: '1 / span 5',
                display: 'flex',
                alignItems: 'center',
                color: 'var(--rose-muted)'
            },
            '& tbody td:not([data-slot])': {
                gridColumn: 2,
                display: 'grid',
                gridTemplateColumns: '3.7rem minmax(0, 1fr)',
                alignItems: 'baseline',
                gap: 'var(--rose-space-xs)',
                overflow: 'visible',
                textOverflow: 'clip'
            },
            '& tbody td:not([data-slot])::before': {
                content: 'attr(data-label)',
                color: 'var(--rose-muted)',
                fontSize: '0.64rem',
                fontWeight: 600
            }
        }
    }
});

const ResponsiveStatLabel = styled('span', {
    base: {
        '&[data-compact]': {
            display: 'none'
        },
        '@media (max-width: 47.99rem)': {
            '&[data-full]': {
                display: 'none'
            },
            '&[data-compact]': {
                display: 'inline'
            }
        }
    }
});

const ResultStatCell = styled('td', {
    base: {
        '&[data-dump="true"]': {
            color: 'var(--rose-muted)'
        }
    }
});

const RollSummary = styled('span', {
    base: {
        display: 'block',
        maxW: '100%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        color: 'var(--rose-muted)',
        fontFamily: MONO_FONT_FAMILY,
        fontSize: '0.68rem'
    }
});

const ExpandedRow = styled('tr', {
    base: {
        '&:hover': {
            bg: 'transparent'
        }
    }
});

const ExpandedCell = styled('td', {
    base: {
        h: 'auto!',
        p: '0!',
        bg: 'var(--rose-surface)',
        borderBottom: '1px solid var(--rose-border)'
    }
});

const RequirementLabel = styled('span', {
    base: {
        display: 'inline-flex',
        alignItems: 'center',
        minH: '1.35rem',
        maxW: '100%',
        px: 'var(--rose-space-xs)',
        borderRadius: 'var(--rose-radius-xs)',
        color: 'var(--rose-muted)',
        bg: 'var(--rose-surface-soft)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontSize: '0.68rem',
        '&[data-kind="set"]': {
            color: 'var(--rose-success)',
            bg: 'color-mix(in srgb, var(--rose-success) 10%, var(--rose-surface-soft))'
        },
        '&[data-kind="exotic"]': {
            color: 'var(--rose-exotic)',
            bg: 'color-mix(in srgb, var(--rose-exotic) 10%, var(--rose-surface-soft))'
        }
    }
});

const StatRoll = styled('span', {
    base: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.15rem var(--rose-space-xs)',
        maxW: '100%',
        color: 'var(--rose-muted)',
        fontFamily: MONO_FONT_FAMILY,
        fontSize: '0.68rem',
        lineHeight: 1.3
    }
});

const StatToken = styled('span', {
    base: {
        whiteSpace: 'nowrap'
    }
});

const ArchetypeDetails = styled('div', {
    base: {
        display: 'grid',
        gap: '0.1rem',
        minW: 0
    }
});

const summarizeArchetypes = (plan: ArmorPlan): string => {
    const counts = new Map<string, number>();
    for (const slot of ARMOR_SLOTS) {
        const name = plan.pieces[slot].roll.archetype.name;
        counts.set(name, (counts.get(name) ?? 0) + 1);
    }

    return [...counts.entries()].map(([name, count]) => (count > 1 ? `${name} x${count}` : name)).join(' · ');
};

const rollStatEntries = (plan: ArmorPlan, slot: ArmorSlot) => {
    const roll = plan.pieces[slot].roll;
    return [
        { stat: roll.archetype.primaryStat, value: 30 },
        { stat: roll.archetype.secondaryStat, value: 25 },
        { stat: roll.tertiaryStat, value: 20 }
    ];
};

const PlanningDetail = (props: { plan: ArmorPlan; slotRequirements: Record<ArmorSlot, PlanningSlotRequirement> }) => (
    <PlanningDetailTable data-density="compact" data-row-surface="soft">
        <colgroup>
            <col data-slot-column />
            <col />
            <col />
            <col />
            <col data-mod-column />
            <col data-tuning-column />
        </colgroup>
        <thead>
            <tr>
                <th>Slot</th>
                <th>Acquire</th>
                <th>Archetype</th>
                <th>Base roll</th>
                <th>Mod</th>
                <th>Tuning</th>
            </tr>
        </thead>
        <tbody>
            <For each={ARMOR_SLOTS}>
                {(slot) => {
                    const piece = () => props.plan.pieces[slot];
                    const requirement = () => props.slotRequirements[slot];

                    return (
                        <tr>
                            <td data-slot>{SLOT_LABELS[slot]}</td>
                            <td data-label="Need">
                                <RequirementLabel data-kind={requirement().kind} title={requirement().label}>
                                    {requirement().label}
                                </RequirementLabel>
                            </td>
                            <td data-label="Roll">
                                <ArchetypeDetails>
                                    <strong>{piece().roll.archetype.name}</strong>
                                    <div data-muted>{STAT_LABELS[piece().roll.tertiaryStat]} tertiary</div>
                                </ArchetypeDetails>
                            </td>
                            <td data-label="Stats">
                                <StatRoll>
                                    <For each={rollStatEntries(props.plan, slot)}>
                                        {(entry, index) => (
                                            <StatToken>{`${STAT_LABELS[entry.stat]} ${entry.value}${index() < 2 ? ' ·' : ''}`}</StatToken>
                                        )}
                                    </For>
                                </StatRoll>
                            </td>
                            <td data-label="Mod" data-muted>
                                {formatStatModName(piece().statMod)}
                            </td>
                            <td data-label="Tuning" data-muted>
                                {formatTuningName(piece().tuning)}
                            </td>
                        </tr>
                    );
                }}
            </For>
        </tbody>
    </PlanningDetailTable>
);

export const PlanningResults = (props: PlanningResultsProps) => (
    <PlanningTableFrame>
        <DataTable data-density="comfortable">
            <colgroup>
                <For each={ARMOR_STATS}>{() => <col data-stat-column />}</For>
                <col data-total-column />
                <col />
            </colgroup>
            <thead>
                <tr>
                    <For each={ARMOR_STATS}>
                        {(stat) => (
                            <th data-numeric title={STAT_LABELS[stat]}>
                                <ResponsiveStatLabel data-full>{STAT_LABELS[stat]}</ResponsiveStatLabel>
                                <ResponsiveStatLabel data-compact>{COMPACT_STAT_LABELS[stat]}</ResponsiveStatLabel>
                            </th>
                        )}
                    </For>
                    <th data-numeric>Total</th>
                    <th>Rolls</th>
                </tr>
            </thead>
            <tbody>
                <For each={props.plans}>
                    {(plan) => (
                        <>
                            <tr
                                data-clickable="true"
                                data-expanded={props.expandedPlanKey === armorPlanExpansionKey(plan)}
                                tabIndex={0}
                                onClick={() => props.onTogglePlan(plan)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault();
                                        props.onTogglePlan(plan);
                                    }
                                }}
                            >
                                <For each={ARMOR_STATS}>
                                    {(stat) => (
                                        <ResultStatCell data-numeric data-dump={props.dumpStat === stat}>
                                            {plan.stats[stat]}
                                        </ResultStatCell>
                                    )}
                                </For>
                                <td data-numeric>{plan.score.totalStats}</td>
                                <td>
                                    <RollSummary title={summarizeArchetypes(plan)}>{summarizeArchetypes(plan)}</RollSummary>
                                </td>
                            </tr>
                            <Show when={props.expandedPlanKey === armorPlanExpansionKey(plan)}>
                                <ExpandedRow>
                                    <ExpandedCell colSpan={8}>
                                        <PlanningDetail plan={plan} slotRequirements={props.slotRequirements} />
                                    </ExpandedCell>
                                </ExpandedRow>
                            </Show>
                        </>
                    )}
                </For>
            </tbody>
        </DataTable>
    </PlanningTableFrame>
);
