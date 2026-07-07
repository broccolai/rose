import type { ArmorStat, StatVector } from '@armor-calc';
import { styled } from '@panda/jsx';

import type { SetSelectionValue } from '@/features/armor/calculator-preferences';
import type { AvailableArmorSet, AvailableExotic, CharacterButtonOption } from '@/features/armor/calculator-view-model';
import { ActionControls } from '@/features/armor/components/action-controls';
import { AdvancedControls } from '@/features/armor/components/advanced-controls';
import { CollapsibleSection, FormRow, RowLabel } from '@/features/armor/components/calculator-control-primitives';
import { CharacterPicker } from '@/features/armor/components/character-picker';
import { DumpControls } from '@/features/armor/components/dump-controls';
import { FragmentControls } from '@/features/armor/components/fragment-controls';
import { ArmorSetFields, ExoticPicker } from '@/features/armor/components/gear-settings';
import { StatTargetFields } from '@/features/armor/components/stat-target-fields';
import { MONO_FONT_FAMILY } from '@/features/armor/components/ui-styles';
import type { ArmorSetDisplayMode } from '@/features/armor/result-display';
import type { SubclassType } from '@/features/armor/subclass-fragments';

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
        pr: { lg: 'var(--rose-space-sm)' },
        mr: { lg: 'calc(var(--rose-space-xs) * -1)' },
        pb: { lg: 'var(--rose-space-sm)' },
        scrollbarGutter: { lg: 'stable' },
        scrollbarWidth: 'thin',
        scrollbarColor: 'color-mix(in srgb, var(--rose-accent) 38%, var(--rose-border)) transparent',
        '&::-webkit-scrollbar': {
            w: '0.45rem'
        },
        '&::-webkit-scrollbar-track': {
            bg: 'transparent'
        },
        '&::-webkit-scrollbar-thumb': {
            borderRadius: '999px',
            bg: 'color-mix(in srgb, var(--rose-muted) 26%, transparent)',
            border: '2px solid transparent',
            backgroundClip: 'content-box'
        },
        '&:hover::-webkit-scrollbar-thumb': {
            bg: 'color-mix(in srgb, var(--rose-accent) 48%, var(--rose-muted) 22%)',
            backgroundClip: 'content-box'
        }
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
