import { ARMOR_STATS, type ArmorStat } from '@armor-domain';
import { styled } from '@panda/jsx';
import { Show } from 'solid-js';

import { CustomSelect, SelectWrap } from '@/features/armor/components/calculator-control-primitives';
import { HelpTooltip } from '@/features/armor/components/help-tooltip';
import { STAT_LABELS } from '@/features/armor/display-metadata';

interface DumpControlsProps {
    dumpStat: ArmorStat | '';
    onDumpStatChange: (stat: string) => void;
}

const InlineControls = styled('div', {
    base: {
        display: 'flex',
        flexWrap: 'nowrap',
        alignItems: 'center',
        gap: 'var(--rose-space-xs)',
        minW: 0
    }
});

export function DumpControls(props: DumpControlsProps) {
    const options = () => [
        { value: '', label: 'None' },
        ...ARMOR_STATS.map((stat) => ({
            value: stat,
            label: STAT_LABELS[stat]
        }))
    ];

    return (
        <InlineControls>
            <SelectWrap>
                <CustomSelect
                    ariaLabel="Dump stat"
                    value={props.dumpStat}
                    options={options()}
                    intent={props.dumpStat ? 'default' : 'warning'}
                    onChange={props.onDumpStatChange}
                />
            </SelectWrap>
            <Show when={!props.dumpStat}>
                <HelpTooltip label="Performance warning" tone="warning">
                    Choose a dump stat for much faster solving.
                </HelpTooltip>
            </Show>
        </InlineControls>
    );
}
