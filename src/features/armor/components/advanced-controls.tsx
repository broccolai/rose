import { styled } from '@panda/jsx';

import { CollapsibleSection, FormRow, RowLabel, SelectInput, ToggleBox } from '@/features/armor/components/calculator-control-primitives';
import type { ArmorSetDisplayMode } from '@/features/armor/result-display';

interface AdvancedControlsProps {
    allowBalancedTuning: boolean;
    armorSetDisplayMode: ArmorSetDisplayMode;
    onlyFullyMasterworkedGear: boolean;
    onArmorSetDisplayModeChange: (mode: ArmorSetDisplayMode) => void;
    onBalancedTuningChange: (enabled: boolean) => void;
    onOnlyFullyMasterworkedGearChange: (enabled: boolean) => void;
}

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

export function AdvancedControls(props: AdvancedControlsProps) {
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
                <ToggleBox data-selected={props.allowBalancedTuning}>
                    <input
                        type="checkbox"
                        checked={props.allowBalancedTuning}
                        onChange={(event) => props.onBalancedTuningChange(event.currentTarget.checked)}
                    />
                </ToggleBox>
            </AdvancedToggleRow>
            <AdvancedToggleRow>
                <span>Only fully masterworked gear</span>
                <ToggleBox data-selected={props.onlyFullyMasterworkedGear}>
                    <input
                        type="checkbox"
                        checked={props.onlyFullyMasterworkedGear}
                        onChange={(event) => props.onOnlyFullyMasterworkedGearChange(event.currentTarget.checked)}
                    />
                </ToggleBox>
            </AdvancedToggleRow>
        </CollapsibleSection>
    );
}
