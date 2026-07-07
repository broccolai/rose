import { ARMOR_STATS, type ArmorStat } from '@armor-calc';
import { styled } from '@panda/jsx';
import { For } from 'solid-js';

import { CollapsibleSection, SecondaryButton, SelectInput, ToggleBox } from '@/features/armor/components/calculator-control-primitives';
import { MONO_FONT_FAMILY } from '@/features/armor/components/ui-styles';
import { STAT_LABELS } from '@/features/armor/display-metadata';
import { fragmentsForSubclass, SUBCLASS_TYPES, type SubclassType } from '@/features/armor/subclass-fragments';

interface FragmentControlsProps {
    selectedSubclass: SubclassType;
    selectedFragmentIds: string[];
    onSubclassChange: (subclass: SubclassType) => void;
    onFragmentToggle: (fragmentId: string) => void;
    onImportFragmentsFromGame: () => void;
}

const FragmentTableFrame = styled('div', {
    base: {
        minW: 0,
        overflow: 'hidden',
        border: '1px solid var(--rose-border)',
        borderRadius: 'var(--rose-radius-md)',
        bg: 'var(--rose-surface)'
    }
});

const FragmentTableScroll = styled('div', {
    base: {
        minW: 0
    }
});

const FragmentFooter = styled('div', {
    base: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr)',
        pt: 'var(--rose-space-xxs)',
        '& button': {
            minW: 0
        }
    }
});

const FragmentTable = styled('table', {
    base: {
        w: '100%',
        minW: 0,
        borderCollapse: 'collapse',
        tableLayout: 'fixed',
        fontFamily: MONO_FONT_FAMILY,
        fontSize: '0.74rem',
        '& th': {
            position: 'sticky',
            top: 0,
            zIndex: 2,
            bg: '#0a0a0c',
            color: 'var(--rose-muted)',
            fontSize: '0.68rem',
            fontWeight: 720,
            lineHeight: 1,
            textAlign: 'left',
            p: 'var(--rose-space-sm) var(--rose-space-xs)',
            borderBottom: '1px solid var(--rose-border)'
        },
        '& td': {
            p: 'var(--rose-space-xs)',
            borderBottom: '1px solid var(--rose-border)',
            color: 'var(--rose-text)',
            lineHeight: 1.2,
            verticalAlign: 'middle'
        },
        '& tr:last-child td': {
            borderBottom: 0
        },
        '& tbody tr[data-selected="true"]': {
            bg: 'color-mix(in srgb, var(--rose-accent) 9%, transparent)'
        },
        '& tbody tr:hover': {
            bg: 'var(--rose-surface-soft)'
        },
        '& tbody tr[data-selected="true"]:hover': {
            bg: 'color-mix(in srgb, var(--rose-accent) 12%, var(--rose-surface-soft))'
        }
    }
});

const FragmentNameCell = styled('td', {
    base: {
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontWeight: 680
    }
});

const FragmentNameHeader = styled('th', {
    base: {
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontWeight: 720
    }
});

const FragmentBonusCell = styled('td', {
    base: {
        color: 'var(--rose-muted-strong)!',
        fontFamily: MONO_FONT_FAMILY,
        textAlign: 'left'
    }
});

const FragmentBonusHeader = styled('th', {
    base: {
        color: 'var(--rose-muted-strong)!',
        fontFamily: MONO_FONT_FAMILY,
        textAlign: 'left'
    }
});

const FragmentCheckCell = styled('td', {
    base: {
        w: '3.4rem',
        textAlign: 'center'
    }
});

const FragmentCheckHeader = styled('th', {
    base: {
        w: '3.4rem',
        textAlign: 'center!'
    }
});

const FragmentBonusList = styled('div', {
    base: {
        display: 'flex',
        justifyContent: 'flex-start',
        gap: 'var(--rose-space-xxs)',
        flexWrap: 'wrap',
        minW: 0
    }
});

const FragmentBonusChip = styled('span', {
    base: {
        display: 'inline-flex',
        alignItems: 'center',
        h: '1.25rem',
        px: '0.38rem',
        borderRadius: '999px',
        bg: 'color-mix(in srgb, var(--rose-surface-raised) 72%, #000 28%)',
        color: 'var(--rose-muted-strong)',
        fontFamily: MONO_FONT_FAMILY,
        fontSize: '0.64rem',
        fontWeight: 760,
        lineHeight: 1,
        '&[data-direction="positive"]': {
            color: 'color-mix(in srgb, var(--rose-accent) 74%, #fff 26%)',
            bg: 'color-mix(in srgb, var(--rose-accent) 14%, transparent)'
        },
        '&[data-direction="negative"]': {
            color: 'color-mix(in srgb, #ff8d8d 82%, var(--rose-muted) 18%)',
            bg: 'color-mix(in srgb, #ff5b5b 10%, transparent)'
        }
    }
});

const formatSignedStat = (value: number, stat: ArmorStat): string => `${value > 0 ? '+' : ''}${value} ${STAT_LABELS[stat]}`;

export function FragmentControls(props: FragmentControlsProps) {
    const selectedIds = () => new Set(props.selectedFragmentIds);
    const fragments = () => fragmentsForSubclass(props.selectedSubclass);

    return (
        <CollapsibleSection
            title={`Fragments${props.selectedFragmentIds.length > 0 ? ` (${props.selectedFragmentIds.length})` : ''}`}
            ariaLabel="Fragments"
        >
            <SelectInput
                size="compact"
                value={props.selectedSubclass}
                onChange={(event) => props.onSubclassChange(event.currentTarget.value as SubclassType)}
            >
                <For each={SUBCLASS_TYPES}>{(subclass) => <option value={subclass}>{subclass}</option>}</For>
            </SelectInput>
            <FragmentTableFrame>
                <FragmentTableScroll>
                    <FragmentTable>
                        <colgroup>
                            <col />
                            <col style={{ width: '7.2rem' }} />
                            <col style={{ width: '3.4rem' }} />
                        </colgroup>
                        <thead>
                            <tr>
                                <FragmentNameHeader>Fragment</FragmentNameHeader>
                                <FragmentBonusHeader>Stats</FragmentBonusHeader>
                                <FragmentCheckHeader>Use</FragmentCheckHeader>
                            </tr>
                        </thead>
                        <tbody>
                            <For each={fragments()}>
                                {(fragment) => {
                                    const selected = () => selectedIds().has(fragment.id);

                                    return (
                                        <tr data-selected={selected()}>
                                            <FragmentNameCell title={fragment.name}>{fragment.name}</FragmentNameCell>
                                            <FragmentBonusCell>
                                                <FragmentBonusList>
                                                    <For each={ARMOR_STATS.filter((stat) => fragment.bonuses[stat])}>
                                                        {(stat) => {
                                                            const value = fragment.bonuses[stat] ?? 0;

                                                            return (
                                                                <FragmentBonusChip data-direction={value > 0 ? 'positive' : 'negative'}>
                                                                    {formatSignedStat(value, stat)}
                                                                </FragmentBonusChip>
                                                            );
                                                        }}
                                                    </For>
                                                </FragmentBonusList>
                                            </FragmentBonusCell>
                                            <FragmentCheckCell>
                                                <ToggleBox as="label" data-selected={selected()}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selected()}
                                                        aria-label={`Toggle ${fragment.name}`}
                                                        onChange={() => props.onFragmentToggle(fragment.id)}
                                                    />
                                                </ToggleBox>
                                            </FragmentCheckCell>
                                        </tr>
                                    );
                                }}
                            </For>
                        </tbody>
                    </FragmentTable>
                </FragmentTableScroll>
            </FragmentTableFrame>
            <FragmentFooter>
                <SecondaryButton type="button" onClick={props.onImportFragmentsFromGame}>
                    Import
                </SecondaryButton>
            </FragmentFooter>
        </CollapsibleSection>
    );
}
