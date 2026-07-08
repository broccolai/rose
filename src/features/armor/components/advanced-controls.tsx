import { styled } from '@panda/jsx';

import { CollapsibleSection, CompactChoiceLabel } from '@/features/armor/components/calculator-control-primitives';
import { MONO_FONT_FAMILY } from '@/features/armor/components/ui-styles';
import type { ArmorSetDisplayMode } from '@/features/armor/result-display';

interface AdvancedControlsProps {
    allowBalancedTuning: boolean;
    armorSetDisplayMode: ArmorSetDisplayMode;
    onlyFullyMasterworkedGear: boolean;
    onArmorSetDisplayModeChange: (mode: ArmorSetDisplayMode) => void;
    onBalancedTuningChange: (enabled: boolean) => void;
    onOnlyFullyMasterworkedGearChange: (enabled: boolean) => void;
}

const AdvancedGrid = styled('div', {
    base: {
        display: 'grid',
        gap: 'var(--rose-space-xs)'
    }
});

const AdvancedRow = styled('div', {
    base: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        alignItems: 'center',
        gap: 'var(--rose-space-sm)',
        minH: 'var(--rose-control-compact-height)',
        minW: 0
    }
});

const AdvancedLabel = styled('span', {
    base: {
        minW: 0,
        overflow: 'hidden',
        color: 'var(--rose-muted)',
        fontFamily: MONO_FONT_FAMILY,
        fontSize: '0.78rem',
        fontWeight: 680,
        lineHeight: 1,
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
    }
});

const AdvancedChoices = styled('div', {
    base: {
        display: 'inline-grid',
        gridAutoFlow: 'column',
        gridAutoColumns: 'minmax(2.75rem, auto)',
        gap: 'var(--rose-space-xs)',
        justifyContent: 'end',
        minW: 0
    }
});

interface AdvancedYesNoRowProps {
    label: string;
    name: string;
    value: boolean;
    onChange: (value: boolean) => void;
}

function AdvancedYesNoRow(props: AdvancedYesNoRowProps) {
    return (
        <AdvancedRow>
            <AdvancedLabel>{props.label}</AdvancedLabel>
            <AdvancedChoices role="radiogroup" aria-label={props.label}>
                <CompactChoiceLabel data-selected={props.value}>
                    <input type="radio" name={props.name} checked={props.value} onChange={() => props.onChange(true)} />Y
                </CompactChoiceLabel>
                <CompactChoiceLabel data-selected={!props.value}>
                    <input type="radio" name={props.name} checked={!props.value} onChange={() => props.onChange(false)} />N
                </CompactChoiceLabel>
            </AdvancedChoices>
        </AdvancedRow>
    );
}

export function AdvancedControls(props: AdvancedControlsProps) {
    return (
        <CollapsibleSection title="Advanced" defaultOpen={false}>
            <AdvancedGrid>
                <AdvancedYesNoRow
                    label="Source as Set Name"
                    name="armor-set-display-mode"
                    value={props.armorSetDisplayMode === 'sources'}
                    onChange={(value) => props.onArmorSetDisplayModeChange(value ? 'sources' : 'sets')}
                />
                <AdvancedYesNoRow
                    label="Use Balanced Tuning"
                    name="balanced-tuning"
                    value={props.allowBalancedTuning}
                    onChange={props.onBalancedTuningChange}
                />
                <AdvancedYesNoRow
                    label="Only use Masterworked items"
                    name="fully-masterworked"
                    value={props.onlyFullyMasterworkedGear}
                    onChange={props.onOnlyFullyMasterworkedGearChange}
                />
            </AdvancedGrid>
        </CollapsibleSection>
    );
}
