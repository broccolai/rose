import { ARMOR_STATS, type ArmorStat } from '@armor-calc';
import { styled } from '@panda/jsx';

import { CustomSelect, SelectWrap } from '@/features/armor/components/calculator-control-primitives';
import { STAT_LABELS } from '@/features/armor/display-metadata';

interface DumpControlsProps {
    dumpStat: ArmorStat | '';
    onDumpStatChange: (stat: string) => void;
}

const InlineControls = styled('div', {
    base: {
        display: 'flex',
        flexWrap: 'wrap',
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
                <CustomSelect ariaLabel="Dump stat" value={props.dumpStat} options={options()} onChange={props.onDumpStatChange} />
            </SelectWrap>
        </InlineControls>
    );
}
