import { ARMOR_STATS, type ArmorStat } from '@armor-calc';
import { styled } from '@panda/jsx';
import { For } from 'solid-js';

import {
    CollapsibleSection,
    CompactChoiceLabel,
    SecondaryButton,
    SelectInput
} from '@/features/armor/components/calculator-control-primitives';
import { DataTable, DataTableFrame } from '@/features/armor/components/data-table';
import { MONO_FONT_FAMILY } from '@/features/armor/components/ui-styles';
import { STAT_LABELS } from '@/features/armor/display-metadata';
import { fragmentsForSubclass, SUBCLASS_TYPES, type SubclassType } from '@/features/armor/subclass-fragments';

interface FragmentControlsProps {
    selectedSubclass: SubclassType;
    selectedFragmentIds: string[];
    onSubclassChange: (subclass: SubclassType) => void;
    onFragmentToggle: (fragmentId: string) => void;
    onImportFragmentsFromGame: () => void;
    importingFragments: boolean;
}

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
        textAlign: 'center'
    }
});

const FragmentCheckHeader = styled('th', {
    base: {
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

const formatSignedStat = (value: number, stat: ArmorStat): string => `${value > 0 ? '+' : ''}${value} ${STAT_LABELS[stat]}`;

export function FragmentControls(props: FragmentControlsProps) {
    const selectedIds = () => new Set(props.selectedFragmentIds);
    const fragments = () => fragmentsForSubclass(props.selectedSubclass);

    return (
        <CollapsibleSection title="Fragments" ariaLabel="Fragments">
            <SelectInput
                size="compact"
                value={props.selectedSubclass}
                onChange={(event) => props.onSubclassChange(event.currentTarget.value as SubclassType)}
            >
                <For each={SUBCLASS_TYPES}>{(subclass) => <option value={subclass}>{subclass}</option>}</For>
            </SelectInput>
            <DataTableFrame>
                <DataTable>
                    <colgroup>
                        <col />
                        <col data-fragment-stat-column />
                        <col data-action-column />
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
                                            <CompactChoiceLabel data-selected={selected()}>
                                                <input
                                                    type="checkbox"
                                                    checked={selected()}
                                                    aria-label={`Toggle ${fragment.name}`}
                                                    onChange={() => props.onFragmentToggle(fragment.id)}
                                                />
                                                {selected() ? 'Y' : 'N'}
                                            </CompactChoiceLabel>
                                        </FragmentCheckCell>
                                    </tr>
                                );
                            }}
                        </For>
                    </tbody>
                </DataTable>
            </DataTableFrame>
            <FragmentFooter>
                <SecondaryButton type="button" disabled={props.importingFragments} onClick={props.onImportFragmentsFromGame}>
                    {props.importingFragments ? 'Importing' : 'Import'}
                </SecondaryButton>
            </FragmentFooter>
        </CollapsibleSection>
    );
}
