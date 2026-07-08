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

export function AdvancedControls(props: AdvancedControlsProps) {
    return (
        <CollapsibleSection title="Advanced" defaultOpen={false}>
            <AdvancedGrid>
                <AdvancedRow>
                    <AdvancedLabel>Set labels</AdvancedLabel>
                    <AdvancedChoices role="radiogroup" aria-label="Armor set label display">
                        <CompactChoiceLabel data-selected={props.armorSetDisplayMode === 'sets'}>
                            <input
                                type="radio"
                                name="armor-set-display-mode"
                                checked={props.armorSetDisplayMode === 'sets'}
                                onChange={() => props.onArmorSetDisplayModeChange('sets')}
                            />
                            Sets
                        </CompactChoiceLabel>
                        <CompactChoiceLabel data-selected={props.armorSetDisplayMode === 'sources'}>
                            <input
                                type="radio"
                                name="armor-set-display-mode"
                                checked={props.armorSetDisplayMode === 'sources'}
                                onChange={() => props.onArmorSetDisplayModeChange('sources')}
                            />
                            Sources
                        </CompactChoiceLabel>
                    </AdvancedChoices>
                </AdvancedRow>
                <AdvancedRow>
                    <AdvancedLabel>Balanced tuning</AdvancedLabel>
                    <AdvancedChoices role="radiogroup" aria-label="Balanced tuning">
                        <CompactChoiceLabel data-selected={!props.allowBalancedTuning}>
                            <input
                                type="radio"
                                name="balanced-tuning"
                                checked={!props.allowBalancedTuning}
                                onChange={() => props.onBalancedTuningChange(false)}
                            />
                            Off
                        </CompactChoiceLabel>
                        <CompactChoiceLabel data-selected={props.allowBalancedTuning}>
                            <input
                                type="radio"
                                name="balanced-tuning"
                                checked={props.allowBalancedTuning}
                                onChange={() => props.onBalancedTuningChange(true)}
                            />
                            On
                        </CompactChoiceLabel>
                    </AdvancedChoices>
                </AdvancedRow>
                <AdvancedRow>
                    <AdvancedLabel>Fully masterworked</AdvancedLabel>
                    <AdvancedChoices role="radiogroup" aria-label="Only use fully masterworked gear">
                        <CompactChoiceLabel data-selected={!props.onlyFullyMasterworkedGear}>
                            <input
                                type="radio"
                                name="fully-masterworked"
                                checked={!props.onlyFullyMasterworkedGear}
                                onChange={() => props.onOnlyFullyMasterworkedGearChange(false)}
                            />
                            Any
                        </CompactChoiceLabel>
                        <CompactChoiceLabel data-selected={props.onlyFullyMasterworkedGear}>
                            <input
                                type="radio"
                                name="fully-masterworked"
                                checked={props.onlyFullyMasterworkedGear}
                                onChange={() => props.onOnlyFullyMasterworkedGearChange(true)}
                            />
                            Full
                        </CompactChoiceLabel>
                    </AdvancedChoices>
                </AdvancedRow>
            </AdvancedGrid>
        </CollapsibleSection>
    );
}
