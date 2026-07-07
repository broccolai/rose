import { ARMOR_STATS, type ArmorStat, type StatVector } from '@armor-calc';
import { styled } from '@panda/jsx';
import { For } from 'solid-js';

import type { SetSelectionValue } from '@/features/armor/calculator-preferences';
import type { AvailableArmorSet, AvailableExotic, CharacterButtonOption } from '@/features/armor/calculator-view-model';
import { CharacterPicker, StatTargetFields } from '@/features/armor/components/class-stat-settings';
import { ArmorSetFields, ExoticPicker } from '@/features/armor/components/gear-settings';
import { MONO_FONT_FAMILY } from '@/features/armor/components/ui-styles';
import { STAT_LABELS } from '@/features/armor/display-metadata';
import type { ArmorSetDisplayMode } from '@/features/armor/result-display';
import { fragmentsForSubclass, SUBCLASS_TYPES, type SubclassType } from '@/features/armor/subclass-fragments';

type CalculatorControlsProps = {
    characterOptions: CharacterButtonOption[];
    selectedCharacterId: string;
    selectedExoticItemHash: string;
    armorSetDisplayMode: ArmorSetDisplayMode;
    selectedSubclass: SubclassType;
    selectedFragmentIds: string[];
    dumpStat: ArmorStat | '';
    allowBalancedTuning: boolean;
    onlyFullyMasterworkedGear: boolean;
    targets: StatVector;
    targetCaps: StatVector;
    targetCapsPending: boolean;
    setSelections: Record<string, SetSelectionValue>;
    availableExotics: AvailableExotic[];
    selectableSets: AvailableArmorSet[];
    canSolve: boolean;
    solving: boolean;
    onCharacterSelect: (characterId: string) => void;
    onExoticChange: (itemHash: string) => void;
    onArmorSetDisplayModeChange: (mode: ArmorSetDisplayMode) => void;
    onSubclassChange: (subclass: SubclassType) => void;
    onFragmentToggle: (fragmentId: string) => void;
    onImportFragmentsFromGame: () => void;
    onDumpStatChange: (stat: string) => void;
    onBalancedTuningChange: (enabled: boolean) => void;
    onOnlyFullyMasterworkedGearChange: (enabled: boolean) => void;
    onTargetChange: (stat: ArmorStat, value: string) => void;
    onSetRequirementChange: (setId: string, value: string) => void;
    onSolve: () => void;
    onClearChoices: () => void;
};

const ControlGrid = styled('div', {
    base: {
        display: 'grid',
        gap: '1rem',
        maxW: 'none',
        mx: 'auto',
        w: '100%'
    }
});

const SettingsPanel = styled('div', {
    base: {
        display: 'grid',
        gap: { base: '1rem', md: '1.08rem' },
        minW: 0,
        p: 0,
        border: 0,
        borderRadius: 0,
        bg: 'transparent',
        boxShadow: 'none'
    }
});

const FormRows = styled('div', {
    base: {
        display: 'grid',
        gridTemplateColumns: { base: 'minmax(0, 1fr)', md: 'minmax(0, 0.9fr) minmax(0, 1.1fr)' },
        gap: '0.72rem',
        alignItems: 'start',
        '& > :last-child': {
            gridColumn: { md: '1 / -1' }
        }
    }
});

const FormRow = styled('label', {
    base: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr)',
        gap: '0.45rem',
        alignItems: 'start',
        minW: 0
    }
});

const RowLabel = styled('span', {
    base: {
        fontFamily: MONO_FONT_FAMILY,
        fontSize: '0.82rem',
        lineHeight: 1,
        fontWeight: 680,
        color: 'var(--rose-muted)'
    }
});

const InlineControls = styled('div', {
    base: {
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '0.55rem',
        minW: 0
    }
});

const SelectWrap = styled('div', {
    base: {
        w: { base: '100%', md: 'min(24rem, 100%)' },
        minW: 0
    }
});

const SelectInput = styled('select', {
    base: {
        w: '100%',
        minW: 0,
        boxSizing: 'border-box',
        minH: '38px',
        border: '1px solid var(--rose-border)',
        borderRadius: '0.5rem',
        bg: 'var(--rose-surface-soft)',
        px: '0.72rem',
        color: 'var(--rose-text)',
        fontFamily: MONO_FONT_FAMILY,
        fontSize: '0.86rem',
        lineHeight: 1.2,
        outline: 'none',
        transition: 'background-color 120ms ease, border-color 120ms ease, opacity 120ms ease',
        _focusVisible: {
            borderColor: 'var(--rose-accent)',
            bg: 'var(--rose-surface-raised)',
            outline: '2px solid color-mix(in srgb, var(--rose-accent) 28%, transparent)',
            outlineOffset: '2px'
        },
        _disabled: {
            opacity: 0.42
        }
    }
});

const DumpSelectInput = styled(SelectInput, {
    base: {
        h: '44px',
        minH: '44px'
    }
});

const Section = styled('section', {
    base: {
        display: 'grid',
        gap: '0.8rem',
        minW: 0,
        pt: '1rem',
        borderTop: '1px solid var(--rose-border)'
    }
});

const SectionTitle = styled('h2', {
    base: {
        m: 0,
        fontFamily: MONO_FONT_FAMILY,
        fontSize: '0.95rem',
        lineHeight: 1,
        fontWeight: 760,
        color: 'var(--rose-text)'
    }
});

const PanelTitle = styled('h2', {
    base: {
        m: 0,
        fontFamily: MONO_FONT_FAMILY,
        fontSize: '1.05rem',
        lineHeight: 1,
        fontWeight: 780,
        color: 'var(--rose-text)'
    }
});

const ActionStack = styled('div', {
    base: {
        display: 'grid',
        gridTemplateColumns: { base: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
        gap: '0.55rem',
        pt: '0.2rem',
        '& button': {
            minW: 0,
            whiteSpace: 'nowrap'
        }
    }
});

const PrimaryButton = styled('button', {
    base: {
        minH: '38px',
        px: '0.9rem',
        border: '1px solid var(--rose-button)',
        borderRadius: '0.5rem',
        bg: 'var(--rose-button)',
        color: 'var(--rose-button-text)',
        fontFamily: MONO_FONT_FAMILY,
        fontSize: '0.82rem',
        letterSpacing: 0,
        fontWeight: 760,
        transition: 'background-color 120ms ease, color 120ms ease, border-color 120ms ease, transform 120ms ease',
        _hover: {
            bg: '#c292ff',
            borderColor: '#c292ff',
            transform: 'translateY(-1px)'
        },
        _disabled: {
            opacity: 0.55,
            cursor: 'not-allowed'
        }
    }
});

const SecondaryButton = styled('button', {
    base: {
        minH: '38px',
        px: '0.9rem',
        border: '1px solid var(--rose-border)',
        borderRadius: '0.5rem',
        bg: 'var(--rose-surface-soft)',
        color: 'var(--rose-text)',
        fontFamily: MONO_FONT_FAMILY,
        fontSize: '0.82rem',
        letterSpacing: 0,
        fontWeight: 700,
        transition: 'background-color 120ms ease, color 120ms ease, border-color 120ms ease, transform 120ms ease',
        _hover: {
            bg: 'var(--rose-surface-raised)',
            color: 'var(--rose-text)',
            borderColor: 'var(--rose-border-strong)',
            transform: 'translateY(-1px)'
        },
        _disabled: {
            opacity: 0.55,
            cursor: 'not-allowed'
        }
    }
});

const AdvancedSection = styled('details', {
    base: {
        pt: '0.8rem',
        borderTop: '1px solid var(--rose-border)',
        '& summary': {
            cursor: 'pointer',
            color: 'var(--rose-muted)',
            fontFamily: MONO_FONT_FAMILY,
            fontSize: '0.82rem',
            fontWeight: 720,
            lineHeight: 1,
            listStyle: 'revert'
        },
        '&[open] summary': {
            color: 'var(--rose-text)'
        }
    }
});

const AdvancedBody = styled('div', {
    base: {
        display: 'grid',
        gap: '0.42rem',
        pt: '0.72rem'
    }
});

const FragmentHeader = styled('div', {
    base: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        gap: '0.65rem',
        alignItems: 'center'
    }
});

const FragmentHeaderActions = styled('div', {
    base: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: '0.5rem',
        flexWrap: 'wrap'
    }
});

const FragmentSubclassSelect = styled(SelectInput, {
    base: {
        h: '34px',
        minH: '34px',
        fontSize: '0.78rem'
    }
});

const FragmentCount = styled('span', {
    base: {
        color: 'var(--rose-muted)',
        fontFamily: MONO_FONT_FAMILY,
        fontSize: '0.72rem',
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap'
    }
});

const FragmentTableFrame = styled('div', {
    base: {
        overflow: 'hidden',
        borderRadius: '0.62rem',
        bg: 'color-mix(in srgb, var(--rose-surface-soft) 70%, #000 30%)'
    }
});

const FragmentTableScroll = styled('div', {
    base: {
        maxH: '13.5rem',
        overflowY: 'auto'
    }
});

const FragmentFooter = styled('div', {
    base: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr)',
        pt: '0.2rem',
        '& button': {
            minW: 0
        }
    }
});

const FragmentTable = styled('table', {
    base: {
        w: '100%',
        borderCollapse: 'collapse',
        tableLayout: 'fixed',
        '& th': {
            position: 'sticky',
            top: 0,
            zIndex: 1,
            bg: 'color-mix(in srgb, var(--rose-surface-soft) 74%, #000 26%)',
            color: 'var(--rose-muted)',
            fontFamily: MONO_FONT_FAMILY,
            fontSize: '0.68rem',
            fontWeight: 760,
            lineHeight: 1,
            textAlign: 'left',
            py: '0.5rem',
            borderBottom: '1px solid var(--rose-border)'
        },
        '& td': {
            py: '0.5rem',
            borderBottom: '1px solid color-mix(in srgb, var(--rose-border) 72%, transparent)',
            color: 'var(--rose-text)',
            fontSize: '0.78rem',
            lineHeight: 1.15,
            verticalAlign: 'middle'
        },
        '& tr:last-child td': {
            borderBottom: 0
        },
        '& tr[data-selected="true"] td': {
            bg: 'color-mix(in srgb, var(--rose-accent) 10%, transparent)'
        },
        '& tbody tr:hover td': {
            bg: 'color-mix(in srgb, var(--rose-accent) 6%, transparent)'
        }
    }
});

const FragmentNameCell = styled('td', {
    base: {
        px: '0.35rem',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontWeight: 660
    }
});

const FragmentNameHeader = styled('th', {
    base: {
        px: '0.35rem',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontWeight: 660
    }
});

const FragmentBonusCell = styled('td', {
    base: {
        px: '0.35rem',
        color: 'var(--rose-muted-strong)!',
        fontFamily: MONO_FONT_FAMILY,
        fontSize: '0.72rem!important',
        textAlign: 'left'
    }
});

const FragmentBonusHeader = styled('th', {
    base: {
        px: '0.35rem',
        color: 'var(--rose-muted-strong)!',
        fontFamily: MONO_FONT_FAMILY,
        fontSize: '0.72rem!important',
        textAlign: 'left'
    }
});

const FragmentCheckCell = styled('td', {
    base: {
        w: '3.4rem',
        pr: '0.45rem',
        textAlign: 'right'
    }
});

const FragmentCheckHeader = styled('th', {
    base: {
        w: '3.4rem',
        pr: '0.45rem',
        textAlign: 'right'
    }
});

const FragmentBonusList = styled('div', {
    base: {
        display: 'flex',
        justifyContent: 'flex-start',
        gap: '0.28rem',
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

const FragmentToggle = styled('span', {
    base: {
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        w: '1.35rem',
        h: '1.35rem',
        border: '1px solid var(--rose-border-strong)',
        borderRadius: '0.34rem',
        bg: 'var(--rose-surface)',
        cursor: 'pointer',
        transition: 'background-color 120ms ease, border-color 120ms ease, transform 120ms ease',
        _hover: {
            borderColor: 'color-mix(in srgb, var(--rose-accent) 58%, var(--rose-border-strong))',
            bg: 'var(--rose-surface-raised)'
        },
        '&[data-selected="true"]': {
            borderColor: 'var(--rose-accent)',
            bg: 'var(--rose-accent)'
        },
        '&[data-selected="true"]::after': {
            content: '""',
            w: '0.5rem',
            h: '0.3rem',
            borderLeft: '2px solid #050508',
            borderBottom: '2px solid #050508',
            transform: 'translateY(-1px) rotate(-45deg)'
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

const AdvancedToggleRow = styled('label', {
    base: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        alignItems: 'center',
        gap: '0.8rem',
        minH: '2rem',
        color: 'var(--rose-text)',
        fontSize: '0.78rem',
        fontWeight: 680
    }
});

function formatSignedStat(value: number, stat: ArmorStat) {
    return `${value > 0 ? '+' : ''}${value} ${STAT_LABELS[stat]}`;
}

function ActionControls(props: Pick<CalculatorControlsProps, 'canSolve' | 'onClearChoices' | 'onSolve' | 'solving'>) {
    return (
        <ActionStack>
            <PrimaryButton type="button" onClick={props.onSolve} disabled={!props.canSolve || props.solving}>
                Solve Builds
            </PrimaryButton>
            <SecondaryButton type="button" onClick={props.onClearChoices}>
                Clear Choices
            </SecondaryButton>
        </ActionStack>
    );
}

function DumpControls(props: Pick<CalculatorControlsProps, 'dumpStat' | 'onDumpStatChange'>) {
    return (
        <InlineControls>
            <SelectWrap>
                <DumpSelectInput value={props.dumpStat} onChange={(event) => props.onDumpStatChange(event.currentTarget.value)}>
                    <option value="">None</option>
                    <For each={ARMOR_STATS}>{(stat) => <option value={stat}>{STAT_LABELS[stat]}</option>}</For>
                </DumpSelectInput>
            </SelectWrap>
        </InlineControls>
    );
}

function FragmentControls(
    props: Pick<
        CalculatorControlsProps,
        'onFragmentToggle' | 'onImportFragmentsFromGame' | 'onSubclassChange' | 'selectedFragmentIds' | 'selectedSubclass'
    >
) {
    const selectedIds = () => new Set(props.selectedFragmentIds);
    const fragments = () => fragmentsForSubclass(props.selectedSubclass);

    return (
        <Section aria-label="Fragments">
            <FragmentHeader>
                <SectionTitle>Fragments</SectionTitle>
                <FragmentHeaderActions>
                    <FragmentCount>{props.selectedFragmentIds.length} selected</FragmentCount>
                </FragmentHeaderActions>
            </FragmentHeader>
            <FragmentSubclassSelect
                value={props.selectedSubclass}
                onChange={(event) => props.onSubclassChange(event.currentTarget.value as SubclassType)}
            >
                <For each={SUBCLASS_TYPES}>{(subclass) => <option value={subclass}>{subclass}</option>}</For>
            </FragmentSubclassSelect>
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
                                                <FragmentToggle as="label" data-selected={selected()}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selected()}
                                                        aria-label={`Toggle ${fragment.name}`}
                                                        onChange={() => props.onFragmentToggle(fragment.id)}
                                                    />
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
        </Section>
    );
}

function AdvancedControls(
    props: Pick<
        CalculatorControlsProps,
        | 'allowBalancedTuning'
        | 'armorSetDisplayMode'
        | 'onArmorSetDisplayModeChange'
        | 'onBalancedTuningChange'
        | 'onOnlyFullyMasterworkedGearChange'
        | 'onlyFullyMasterworkedGear'
    >
) {
    return (
        <AdvancedSection>
            <summary>Advanced</summary>
            <AdvancedBody>
                <FormRow>
                    <RowLabel>Armor set labels</RowLabel>
                    <SelectInput
                        value={props.armorSetDisplayMode}
                        onChange={(event) => props.onArmorSetDisplayModeChange(event.currentTarget.value as ArmorSetDisplayMode)}
                    >
                        <option value="sets">Set names</option>
                        <option value="sources">Sources</option>
                    </SelectInput>
                </FormRow>
                <AdvancedToggleRow>
                    <span>Balanced tuning</span>
                    <FragmentToggle data-selected={props.allowBalancedTuning}>
                        <input
                            type="checkbox"
                            checked={props.allowBalancedTuning}
                            onChange={(event) => props.onBalancedTuningChange(event.currentTarget.checked)}
                        />
                    </FragmentToggle>
                </AdvancedToggleRow>
                <AdvancedToggleRow>
                    <span>Only fully masterworked gear</span>
                    <FragmentToggle data-selected={props.onlyFullyMasterworkedGear}>
                        <input
                            type="checkbox"
                            checked={props.onlyFullyMasterworkedGear}
                            onChange={(event) => props.onOnlyFullyMasterworkedGearChange(event.currentTarget.checked)}
                        />
                    </FragmentToggle>
                </AdvancedToggleRow>
            </AdvancedBody>
        </AdvancedSection>
    );
}

export function CalculatorControls(props: CalculatorControlsProps) {
    return (
        <ControlGrid>
            <SettingsPanel>
                <PanelTitle>Build Inputs</PanelTitle>
                <FormRows>
                    <FormRow as="div">
                        <RowLabel>Class</RowLabel>
                        <CharacterPicker
                            labelText={false}
                            options={props.characterOptions}
                            selectedCharacterId={props.selectedCharacterId}
                            onSelect={props.onCharacterSelect}
                        />
                    </FormRow>

                    <FormRow as="div">
                        <RowLabel>Dump</RowLabel>
                        <DumpControls dumpStat={props.dumpStat} onDumpStatChange={props.onDumpStatChange} />
                    </FormRow>

                    <FormRow as="div">
                        <RowLabel>Exotic</RowLabel>
                        <ExoticPicker
                            labelText={false}
                            availableExotics={props.availableExotics}
                            onExoticChange={props.onExoticChange}
                            selectedExoticItemHash={props.selectedExoticItemHash}
                        />
                    </FormRow>
                </FormRows>

                <Section aria-label="Targets">
                    <SectionTitle>Targets</SectionTitle>
                    <StatTargetFields
                        allowBalancedTuning={props.allowBalancedTuning}
                        dumpStat={props.dumpStat}
                        onTargetChange={props.onTargetChange}
                        targetCapsPending={props.targetCapsPending}
                        targetCaps={props.targetCaps}
                        targets={props.targets}
                    />
                </Section>

                <FragmentControls
                    selectedSubclass={props.selectedSubclass}
                    selectedFragmentIds={props.selectedFragmentIds}
                    onSubclassChange={props.onSubclassChange}
                    onFragmentToggle={props.onFragmentToggle}
                    onImportFragmentsFromGame={props.onImportFragmentsFromGame}
                />

                <Section aria-label="Sets">
                    <SectionTitle>Sets</SectionTitle>
                    <ArmorSetFields
                        armorSetDisplayMode={props.armorSetDisplayMode}
                        onSetRequirementChange={props.onSetRequirementChange}
                        selectableSets={props.selectableSets}
                        setSelections={props.setSelections}
                    />
                </Section>

                <AdvancedControls
                    allowBalancedTuning={props.allowBalancedTuning}
                    armorSetDisplayMode={props.armorSetDisplayMode}
                    onlyFullyMasterworkedGear={props.onlyFullyMasterworkedGear}
                    onArmorSetDisplayModeChange={props.onArmorSetDisplayModeChange}
                    onBalancedTuningChange={props.onBalancedTuningChange}
                    onOnlyFullyMasterworkedGearChange={props.onOnlyFullyMasterworkedGearChange}
                />

                <ActionControls
                    canSolve={props.canSolve}
                    onClearChoices={props.onClearChoices}
                    onSolve={props.onSolve}
                    solving={props.solving}
                />
            </SettingsPanel>
        </ControlGrid>
    );
}
