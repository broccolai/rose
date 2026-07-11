import { styled } from '@panda/jsx';

import { CompactChoiceLabel } from '@/features/armor/components/calculator-control-primitives';
import { HelpTooltip } from '@/features/armor/components/help-tooltip';
import { MONO_FONT_FAMILY } from '@/features/armor/components/ui-styles';
import type { ArmorSetDisplayMode } from '@/features/armor/result-display';

interface AdvancedControlsProps {
    allowBalancedTuning: boolean;
    armorSetDisplayMode: ArmorSetDisplayMode;
    onlyFullyMasterworkedGear: boolean;
    refreshVaultOnStartup: boolean;
    onArmorSetDisplayModeChange: (mode: ArmorSetDisplayMode) => void;
    onBalancedTuningChange: (enabled: boolean) => void;
    onOnlyFullyMasterworkedGearChange: (enabled: boolean) => void;
    onRefreshVaultOnStartupChange: (enabled: boolean) => void;
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
        minH: 'calc(var(--rose-control-compact-height) + 0.15rem)',
        minW: 0
    }
});

const AdvancedLabel = styled('span', {
    base: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--rose-space-xxs)',
        minW: 0,
        overflow: 'hidden',
        color: 'var(--rose-muted)',
        fontFamily: MONO_FONT_FAMILY,
        fontSize: '0.78rem',
        fontWeight: 600,
        lineHeight: 1.35,
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
    helpText: string;
    label: string;
    name: string;
    value: boolean;
    onChange: (value: boolean) => void;
}

function AdvancedYesNoRow(props: AdvancedYesNoRowProps) {
    return (
        <AdvancedRow>
            <AdvancedLabel>
                {props.label}
                <HelpTooltip label={`About ${props.label}`}>{props.helpText}</HelpTooltip>
            </AdvancedLabel>
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

export function AdvancedControlsBody(props: AdvancedControlsProps) {
    return (
        <AdvancedGrid>
            <AdvancedYesNoRow
                label="Source as Set Name"
                helpText="Shows known activity or raid sources instead of Bungie's armor set names."
                name="armor-set-display-mode"
                value={props.armorSetDisplayMode === 'sources'}
                onChange={(value) => props.onArmorSetDisplayModeChange(value ? 'sources' : 'sets')}
            />
            <AdvancedYesNoRow
                label="Use Balanced Tuning"
                helpText="Allows +1 to an armor piece's three lowest stats as a tuning choice."
                name="balanced-tuning"
                value={props.allowBalancedTuning}
                onChange={props.onBalancedTuningChange}
            />
            <AdvancedYesNoRow
                label="Refresh Vault on Startup"
                helpText="Fetches a fresh full inventory from Bungie whenever ARMOR opens. Leave off for faster cached startup."
                name="refresh-vault-on-startup"
                value={props.refreshVaultOnStartup}
                onChange={props.onRefreshVaultOnStartupChange}
            />
            <AdvancedYesNoRow
                label="Only use Masterworked items"
                helpText="Excludes armor that is not currently fully masterworked instead of assuming it will be masterworked."
                name="fully-masterworked"
                value={props.onlyFullyMasterworkedGear}
                onChange={props.onOnlyFullyMasterworkedGearChange}
            />
        </AdvancedGrid>
    );
}
