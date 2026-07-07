import { ARMOR_STATS, type ArmorStat, type StatVector } from '@armor-calc';
import { styled } from '@panda/jsx';
import { For, type JSX } from 'solid-js';

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
        gap: 'var(--rose-space-md)',
        maxW: 'none',
        mx: 'auto',
        w: '100%',
        minH: 0
    }
});

const SettingsPanel = styled('div', {
    base: {
        display: 'grid',
        gridTemplateRows: { lg: 'auto minmax(0, 1fr) auto' },
        gap: 'var(--rose-space-md)',
        minW: 0,
        minH: 0,
        h: { lg: '100%' },
        p: 0,
        border: 0,
        borderRadius: 0,
        bg: 'transparent',
        boxShadow: 'none'
    }
});

const SettingsScroll = styled('div', {
    base: {
        display: 'grid',
        gap: 'var(--rose-space-md)',
        minW: 0,
        minH: 0,
        overflow: { lg: 'auto' },
        pr: { lg: 'var(--rose-space-xs)' },
        pb: { lg: 'var(--rose-space-sm)' }
    }
});

const FormRows = styled('div', {
    base: {
        display: 'grid',
        gridTemplateColumns: { base: 'minmax(0, 1fr)', md: 'minmax(0, 0.9fr) minmax(0, 1.1fr)' },
        gap: 'var(--rose-space-sm)',
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
        gap: 'var(--rose-space-xs)',
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
        gap: 'var(--rose-space-xs)',
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
        minH: 'var(--rose-control-height)',
        border: '1px solid var(--rose-border)',
        borderRadius: 'var(--rose-radius-sm)',
        bg: 'var(--rose-surface-soft)',
        px: 'var(--rose-control-padding-x)',
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
        h: 'var(--rose-control-height)',
        minH: 'var(--rose-control-height)'
    }
});

const Section = styled('details', {
    base: {
        display: 'grid',
        gap: 'var(--rose-space-sm)',
        minW: 0,
        pt: 'var(--rose-space-md)',
        borderTop: '1px solid var(--rose-border)',
        '& summary::-webkit-details-marker': {
            display: 'none'
        },
        '&[open]': {
            gap: 'var(--rose-space-sm)'
        },
        '&[open] [data-section-chevron]': {
            transform: 'rotate(45deg)'
        }
    }
});

const SectionSummary = styled('summary', {
    base: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        alignItems: 'center',
        gap: 'var(--rose-space-sm)',
        minW: 0,
        cursor: 'pointer',
        listStyle: 'none',
        _focusVisible: {
            outline: '2px solid color-mix(in srgb, var(--rose-accent) 34%, transparent)',
            outlineOffset: '3px',
            borderRadius: 'var(--rose-radius-sm)'
        }
    }
});

const SectionBody = styled('div', {
    base: {
        display: 'grid',
        gap: 'var(--rose-space-sm)',
        minW: 0,
        pt: 'var(--rose-space-sm)'
    }
});

const SectionChevron = styled('span', {
    base: {
        display: 'block',
        w: '0.48rem',
        h: '0.48rem',
        borderRight: '1.5px solid var(--rose-muted)',
        borderBottom: '1.5px solid var(--rose-muted)',
        transform: 'rotate(-45deg)',
        transition: 'transform 120ms ease, border-color 120ms ease'
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
        gap: 'var(--rose-space-sm)',
        pt: { base: 'var(--rose-space-xxs)', lg: 'var(--rose-space-md)' },
        borderTop: { lg: '1px solid var(--rose-border)' },
        bg: 'var(--rose-bg)',
        '& button': {
            minW: 0,
            whiteSpace: 'nowrap'
        }
    }
});

const PrimaryButton = styled('button', {
    base: {
        minH: 'var(--rose-control-height)',
        px: 'var(--rose-control-padding-x)',
        border: '1px solid var(--rose-button)',
        borderRadius: 'var(--rose-radius-sm)',
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
        minH: 'var(--rose-control-height)',
        px: 'var(--rose-control-padding-x)',
        border: '1px solid var(--rose-border)',
        borderRadius: 'var(--rose-radius-sm)',
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

const FragmentSubclassSelect = styled(SelectInput, {
    base: {
        h: 'var(--rose-control-compact-height)',
        minH: 'var(--rose-control-compact-height)',
        fontSize: '0.78rem'
    }
});

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

const FragmentToggle = styled('span', {
    base: {
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        w: '1.35rem',
        h: '1.35rem',
        border: '1px solid var(--rose-border-strong)',
        borderRadius: '0.375rem',
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
        gap: 'var(--rose-space-sm)',
        minH: 'var(--rose-control-compact-height)',
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

function CollapsibleSection(props: { title: string; children: JSX.Element; defaultOpen?: boolean; ariaLabel?: string }) {
    return (
        <Section open={props.defaultOpen ?? true} aria-label={props.ariaLabel ?? props.title}>
            <SectionSummary>
                <SectionTitle>{props.title}</SectionTitle>
                <SectionChevron data-section-chevron aria-hidden="true" />
            </SectionSummary>
            <SectionBody>{props.children}</SectionBody>
        </Section>
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
        <CollapsibleSection
            title={`Fragments${props.selectedFragmentIds.length > 0 ? ` (${props.selectedFragmentIds.length})` : ''}`}
            ariaLabel="Fragments"
        >
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
        </CollapsibleSection>
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
        <CollapsibleSection title="Advanced" defaultOpen={false}>
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
        </CollapsibleSection>
    );
}

export function CalculatorControls(props: CalculatorControlsProps) {
    return (
        <ControlGrid>
            <SettingsPanel>
                <PanelTitle>Build Inputs</PanelTitle>
                <SettingsScroll>
                    <CollapsibleSection title="Gear">
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
                    </CollapsibleSection>

                    <CollapsibleSection title="Targets">
                        <StatTargetFields
                            allowBalancedTuning={props.allowBalancedTuning}
                            dumpStat={props.dumpStat}
                            onTargetChange={props.onTargetChange}
                            targetCapsPending={props.targetCapsPending}
                            targetCaps={props.targetCaps}
                            targets={props.targets}
                        />
                    </CollapsibleSection>

                    <FragmentControls
                        selectedSubclass={props.selectedSubclass}
                        selectedFragmentIds={props.selectedFragmentIds}
                        onSubclassChange={props.onSubclassChange}
                        onFragmentToggle={props.onFragmentToggle}
                        onImportFragmentsFromGame={props.onImportFragmentsFromGame}
                    />

                    <CollapsibleSection title="Sets">
                        <ArmorSetFields
                            armorSetDisplayMode={props.armorSetDisplayMode}
                            onSetRequirementChange={props.onSetRequirementChange}
                            selectableSets={props.selectableSets}
                            setSelections={props.setSelections}
                        />
                    </CollapsibleSection>

                    <AdvancedControls
                        allowBalancedTuning={props.allowBalancedTuning}
                        armorSetDisplayMode={props.armorSetDisplayMode}
                        onlyFullyMasterworkedGear={props.onlyFullyMasterworkedGear}
                        onArmorSetDisplayModeChange={props.onArmorSetDisplayModeChange}
                        onBalancedTuningChange={props.onBalancedTuningChange}
                        onOnlyFullyMasterworkedGearChange={props.onOnlyFullyMasterworkedGearChange}
                    />
                </SettingsScroll>

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
