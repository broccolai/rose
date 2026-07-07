import { ARMOR_STATS, type ArmorStat } from '@armor-calc';
import { styled } from '@panda/jsx';
import { For } from 'solid-js';

import { CollapsibleSection, SecondaryButton, SelectInput } from '@/features/armor/components/calculator-control-primitives';
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
        textAlign: 'left',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
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
        w: '3.75rem',
        textAlign: 'center'
    }
});

const FragmentCheckHeader = styled('th', {
    base: {
        w: '3.75rem',
        textAlign: 'center!'
    }
});

const FragmentBonusList = styled('div', {
    base: {
        minW: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
    }
});

const FragmentBonusText = styled('span', {
    base: {
        color: 'var(--rose-muted-strong)',
        fontFamily: MONO_FONT_FAMILY,
        fontSize: '0.72rem',
        fontWeight: 700,
        lineHeight: 1,
        '&[data-direction="positive"]': {
            color: 'color-mix(in srgb, var(--rose-accent) 74%, #fff 26%)'
        },
        '&[data-direction="negative"]': {
            color: 'color-mix(in srgb, #ff8d8d 82%, var(--rose-muted) 18%)'
        }
    }
});

const FragmentToggle = styled('label', {
    base: {
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minW: '2.75rem',
        h: 'var(--rose-control-compact-height)',
        border: '1px solid var(--rose-border)',
        borderRadius: 'var(--rose-radius-sm)',
        bg: 'var(--rose-surface-soft)',
        color: 'var(--rose-muted)',
        fontFamily: MONO_FONT_FAMILY,
        fontSize: '0.78rem',
        fontWeight: 760,
        lineHeight: 1,
        cursor: 'pointer',
        transition: 'background-color 120ms ease, border-color 120ms ease, color 120ms ease',
        _hover: {
            bg: 'var(--rose-surface-raised)',
            color: 'var(--rose-text)'
        },
        '&[data-selected="true"]': {
            bg: 'var(--rose-button)',
            borderColor: 'var(--rose-button)',
            color: 'var(--rose-button-text)'
        },
        '&:has(input:focus-visible)': {
            outline: '2px solid color-mix(in srgb, var(--rose-accent) 40%, transparent)',
            outlineOffset: '2px'
        },
        '& input': {
            position: 'absolute',
            inset: 0,
            opacity: 0,
            cursor: 'pointer'
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
                            <col style={{ width: '3.75rem' }} />
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
                                                                <FragmentBonusText data-direction={value > 0 ? 'positive' : 'negative'}>
                                                                    {formatSignedStat(value, stat)}
                                                                </FragmentBonusText>
                                                            );
                                                        }}
                                                    </For>
                                                </FragmentBonusList>
                                            </FragmentBonusCell>
                                            <FragmentCheckCell>
                                                <FragmentToggle data-selected={selected()}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selected()}
                                                        aria-label={`Toggle ${fragment.name}`}
                                                        onChange={() => props.onFragmentToggle(fragment.id)}
                                                    />
                                                    {selected() ? 'Y' : 'N'}
                                                </FragmentToggle>
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
