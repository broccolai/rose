import { styled } from '@panda/jsx';

import { useArmorCalculator } from '@/features/armor/armor-calculator-context';
import { ActionControls } from '@/features/armor/components/action-controls';
import { CollapsibleSection, FormRow, RowLabel } from '@/features/armor/components/calculator-control-primitives';
import { CharacterPicker } from '@/features/armor/components/character-picker';
import { DumpControls } from '@/features/armor/components/dump-controls';
import { FragmentControls } from '@/features/armor/components/fragment-controls';
import { ArmorSetFields, ExoticPicker } from '@/features/armor/components/gear-settings';
import { PaneScroll } from '@/features/armor/components/scroll-primitives';
import { StatTargetFields } from '@/features/armor/components/stat-target-fields';
import { MONO_FONT_FAMILY } from '@/features/armor/components/ui-styles';

const ControlGrid = styled('div', {
    base: {
        display: 'grid',
        gap: 'var(--rose-space-sm)',
        maxW: 'none',
        mx: 'auto',
        w: '100%',
        minH: 0
    }
});

const SettingsPanel = styled('div', {
    base: {
        '--rose-control-height': '2.5rem',
        '--rose-control-compact-height': '2rem',
        '--rose-control-padding-x': '0.85rem',
        display: 'grid',
        gridTemplateRows: { lg: 'auto minmax(0, 1fr) auto' },
        gap: 'var(--rose-space-sm)',
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

const SettingsScroll = styled(PaneScroll, {
    base: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr)',
        gap: 'var(--rose-space-sm)',
        alignContent: 'start',
        alignItems: 'start',
        '@media (min-width: 112rem)': {
            gridTemplateColumns: 'minmax(0, 0.94fr) minmax(0, 1.06fr)',
            gap: 'var(--rose-space-md)'
        }
    }
});

const SettingsColumn = styled('div', {
    base: {
        display: 'grid',
        gap: 'var(--rose-space-sm)',
        alignContent: 'start',
        minW: 0
    }
});

const FormRows = styled('div', {
    base: {
        display: 'grid',
        gridTemplateColumns: { base: 'minmax(0, 1fr)', md: 'minmax(0, 0.9fr) minmax(0, 1.1fr)' },
        gap: 'var(--rose-space-xs)',
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
        fontSize: '1rem',
        lineHeight: 1,
        fontWeight: 780,
        color: 'var(--rose-text)'
    }
});

export function CalculatorControls() {
    const calculator = useArmorCalculator();
    const controls = calculator.controls;
    const actions = calculator.actions;

    return (
        <ControlGrid>
            <SettingsPanel>
                <PanelTitle>Build Inputs</PanelTitle>
                <SettingsScroll>
                    <SettingsColumn>
                        <CollapsibleSection title="Gear">
                            <FormRows>
                                <FormRow as="div">
                                    <RowLabel>Class</RowLabel>
                                    <CharacterPicker
                                        labelText={false}
                                        options={controls.characterOptions()}
                                        selectedCharacterId={controls.selectedCharacterId()}
                                        onSelect={actions.selectCharacter}
                                    />
                                </FormRow>

                                <FormRow as="div">
                                    <RowLabel>Dump</RowLabel>
                                    <DumpControls dumpStat={controls.dumpStat()} onDumpStatChange={actions.setDumpStat} />
                                </FormRow>

                                <FormRow as="div">
                                    <RowLabel>Exotic</RowLabel>
                                    <ExoticPicker
                                        labelText={false}
                                        availableExotics={controls.availableExotics()}
                                        onExoticChange={actions.selectExotic}
                                        selectedExoticItemHash={controls.selectedExoticItemHash()}
                                    />
                                </FormRow>
                            </FormRows>
                        </CollapsibleSection>

                        <CollapsibleSection title="Targets">
                            <StatTargetFields
                                allowBalancedTuning={controls.allowBalancedTuning()}
                                dumpStat={controls.dumpStat()}
                                onTargetChange={actions.setTarget}
                                targetCapsPending={controls.targetCapsPending()}
                                targetCaps={controls.targetCaps()}
                                targets={controls.targets()}
                            />
                        </CollapsibleSection>

                        <FragmentControls
                            selectedSubclass={controls.selectedSubclass()}
                            selectedFragmentIds={controls.selectedFragmentIds()}
                            onSubclassChange={actions.setSubclass}
                            onFragmentToggle={actions.toggleFragment}
                            onImportFragmentsFromGame={actions.importFragmentsFromGame}
                            importingFragments={controls.importingFragments()}
                        />
                    </SettingsColumn>

                    <SettingsColumn>
                        <CollapsibleSection title="Sets">
                            <ArmorSetFields
                                armorSetDisplayMode={controls.armorSetDisplayMode()}
                                availableExotics={controls.availableExotics()}
                                onSetRequirementChange={actions.setRequirement}
                                selectableSets={controls.selectableSets()}
                                selectedExoticItemHash={controls.selectedExoticItemHash()}
                                setSelections={controls.setSelections()}
                            />
                        </CollapsibleSection>
                    </SettingsColumn>
                </SettingsScroll>

                <ActionControls
                    canSolve={controls.canSolve()}
                    onClearChoices={actions.clearChoices}
                    onSolve={actions.solve}
                    solving={controls.solving()}
                />
            </SettingsPanel>
        </ControlGrid>
    );
}
